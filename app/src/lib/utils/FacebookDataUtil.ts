import { RedisClient } from "markly-ts-core";
import type {
  AccountHierarchy,
  Root,
} from "markly-ts-core/dist/lib/interfaces/FacebookInterfaces.js";
import {FacebookReportsApi} from "../apis/FacebookReportsApi.js";

export class FacebookDataUtil {
  private static CACHE_EXPIRY = 3600;

  public static async getAllReportData(
    organizationUuid: string,
    accountId: string,
    datePreset: string,
  ) {
    const api = await FacebookReportsApi.create(organizationUuid, accountId);

    const [bestAds, KPIs, campaigns, graphs] = await Promise.all([
      this.get10BestPerformingAds(organizationUuid, accountId, datePreset),
      await api.getKpis(datePreset),
      await api.getCampaigns(datePreset),
      await api.getGraphs(datePreset),
    ]);

    return { bestAds, KPIs, campaigns, graphs };
  }

  private static async get10BestPerformingAds(
    organizationUuid: string,
    datePreset: string,
    accountId: string,
  ) {
    const cacheKey = `bestAds:${organizationUuid}:${datePreset}`;

    const cachedData = await RedisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const api = await FacebookReportsApi.create(organizationUuid, accountId);

    const data = await api.getAds(datePreset);
    const ads = data.data;
    const bestAds = await this.processAds(ads, organizationUuid, accountId);

    await RedisClient.set(cacheKey, JSON.stringify(bestAds), this.CACHE_EXPIRY);

    return bestAds;
  }

  private static getBest10AdsByROAS(ads: any[]): any[] {
    return ads
      .filter((ad) => ad.insights?.data?.[0]?.purchase_roas?.[0]?.value)
      .sort((a, b) => {
        const roasA = parseFloat(a.insights.data[0].purchase_roas[0].value);
        const roasB = parseFloat(b.insights.data[0].purchase_roas[0].value);
        return roasB - roasA;
      })
      .slice(0, 10);
  }

  private static async processAds(
    ads: any[],
    organizationUuid: string,
    accountId: string,
  ) {
    const shownAds = this.getBest10AdsByROAS(ads);

    const reportAds = shownAds.map((ad) => ({
      adCreativeId: ad.creative.id,
      thumbnailUrl: "",
      spend: ad.insights.data[0].spend,
      addToCart:
        ad.insights.data[0].actions?.find(
          (action: any) => action.action_type === "add_to_cart",
        )?.value || "0",
      purchases:
        ad.insights.data[0].actions?.find(
          (action: any) => action.action_type === "purchase",
        )?.value || "0",
      roas: ad.insights.data[0].purchase_roas[0].value || "0",
      sourceUrl: "",
    }));

    const creativeAssets = await Promise.all(
      shownAds.map(async (ad) => {
        const creativeId = ad.creative.id;
        const cacheKey = `creativeAsset:${creativeId}`;

        const cachedData = await RedisClient.get(cacheKey);
        if (cachedData) {
          return JSON.parse(cachedData);
        }

        const api = await FacebookReportsApi.create(
          organizationUuid,
          accountId,
        );

        const creativeAsset = await api.getCreativeAsset(creativeId);

        await RedisClient.set(
          cacheKey,
          JSON.stringify(creativeAsset),
          this.CACHE_EXPIRY,
        );

        return creativeAsset;
      }),
    );

    await Promise.all(
      creativeAssets.map(async (creativeAsset, index) => {
        const { effective_instagram_media_id, effective_object_story_id } =
          creativeAsset;
        const reportAd = reportAds[index];

        if (effective_instagram_media_id) {
          const cacheKey = `igMedia:${effective_instagram_media_id}`;

          const cachedData = await RedisClient.get(cacheKey);
          let igMedia;
          if (cachedData) {
            igMedia = JSON.parse(cachedData);
          } else {
            const api = await FacebookReportsApi.create(
              organizationUuid,
              accountId,
            );

            igMedia = await api.getIgMedia(effective_instagram_media_id);

            await RedisClient.set(
              cacheKey,
              JSON.stringify(igMedia),
              this.CACHE_EXPIRY,
            );
          }

          reportAd.thumbnailUrl =
            igMedia.media_type === "IMAGE" && !igMedia.thumbnail_url
              ? igMedia.media_url
              : igMedia.thumbnail_url;
          reportAd.sourceUrl = igMedia.permalink;
        } else {
          const postId = effective_object_story_id.split("_")[1];
          const cacheKey = `post:${postId}`;

          const cachedData = await RedisClient.get(cacheKey);
          let post;
          if (cachedData) {
            post = JSON.parse(cachedData);
          } else {
            const api = await FacebookReportsApi.create(
              organizationUuid,
              accountId,
            );

            post = await api.getPost(postId);

            await RedisClient.set(
              cacheKey,
              JSON.stringify(post),
              this.CACHE_EXPIRY,
            );
          }

          reportAd.thumbnailUrl =
            post.data[0].adcreatives.data[0].thumbnail_url;
          reportAd.sourceUrl = post.data[0].preview_shareable_link;
        }
      }),
    );

    return reportAds;
  }

  public static extractAccountHierarchy(root: Root): AccountHierarchy[] {
    return root.data
      .map((account) => ({
        id: account.id,
        name: account.name,
        owned_ad_accounts: account.owned_ad_accounts
          ? account.owned_ad_accounts.data
              .map((owned) => ({
                id: owned.id,
                name: owned.name,
              }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : [],
        client_ad_accounts: account.client_ad_accounts
          ? account.client_ad_accounts.data
              .map((client) => ({
                id: client.id,
                name: client.name,
              }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
