import type {
  AccountHierarchy,
  Root,
} from "marklie-ts-core/dist/lib/interfaces/FacebookInterfaces.js";
import { FacebookApi } from "../apis/FacebookApi.js";

export class FacebookDataUtil {

  public static async getAllReportData(
    organizationUuid: string,
    accountId: string,
    datePreset: string,
  ) {
      const api = await FacebookApi.create(organizationUuid, accountId);

    const [ ads, KPIs, campaigns, graphs] = await Promise.all([
      api.getAds(datePreset),
      api.getAccountInsights(datePreset),
      api.getCampaigns(datePreset),
      api.getCampaignInsights(datePreset),
    ]);


    const processedAds = await this.processAds(
      ads.data,
      organizationUuid,
      accountId,
    );

    return {  ads: processedAds, KPIs: this.normalizeKPIs(KPIs[0]), campaigns: this.normalizeCampaigns(campaigns), graphs: this.normalizeGraphs(graphs) };
  }

  private static normalizeGraphs(graphs: any[]) {
      return graphs.map((g) => {
          const spend = parseFloat(g.spend || "0");
          const clicks = parseInt(g.clicks || "0");
          const impressions = parseInt(g.impressions || "0");

          const actions = Object.fromEntries(
              (g.actions || []).map((a: any) => [a.action_type, Number(a.value)])
          );

          const purchaseRoas = g.purchase_roas?.[0]?.value || 0;
          const purchases = actions["purchase"] || 0;
          const addToCart = actions["add_to_cart"] || 0;
          const initiatedCheckouts = actions["initiate_checkout"] || 0;
          const engagement = actions["post_engagement"] || actions["page_engagement"] || 0;

          const conversionValue = g.action_values?.find((a: any) => a.action_type === "purchase")?.value || 0;

          return {
              campaign_id: g.campaign_id,
              campaign_name: g.campaign_name,
              spend: spend.toFixed(2),
              impressions,
              clicks,
              ctr: parseFloat(g.ctr || 0).toFixed(2),
              cpc: clicks > 0 ? (spend / clicks).toFixed(2) : "0.00",
              purchaseRoas: parseFloat(purchaseRoas).toFixed(2),
              conversionValue: parseFloat(conversionValue).toFixed(2),
              engagement,
              purchases,
              costPerPurchase: purchases > 0 ? (spend / purchases).toFixed(2) : "0.00",
              costPerCart: addToCart > 0 ? (spend / addToCart).toFixed(2) : "0.00",
              addToCart,
              initiatedCheckouts,
              conversionRate: clicks > 0 ? ((purchases / clicks) * 100).toFixed(2) : "0.00",
              date_start: g.date_start,
              date_stop: g.date_stop,
          };
      });
  }

  private static normalizeCampaigns(campaigns: any[]): any[] {
      return campaigns.map((c, index) => {
          const actions = c.actions || [];
          const purchasesAction = actions.find(
            (a: { action_type: string }) => a.action_type === "purchase",
          );
          const purchases = parseInt(purchasesAction?.value || '0');

          const spend = parseFloat(c.spend || '0');
          const clicks = parseInt(c.clicks || '0');
          const roas = parseFloat(c.purchase_roas?.[0]?.value || '0');

          const conversionRate = clicks > 0 ? ((purchases / clicks) * 100).toFixed(2) : '0.00';

          return {
              index,
              campaign_name: c.campaign_name,
              spend: spend.toFixed(2),
              purchases,
              conversionRate,
              purchaseRoas: roas.toFixed(2),
          };
      });
  }

    private static normalizeKPIs(apiData: any) {
        const getActionValue = (type: string) =>
            apiData.actions?.find((a: any) => a.action_type === type)?.value || 0;

        const getActionMonetaryValue = (type: string) =>
            apiData.action_values?.find((a: any) => a.action_type === type)?.value || 0;

        return {
            spend: apiData.spend,
            purchaseRoas: apiData.purchase_roas?.[0]?.value || 0,
            conversionValue: getActionMonetaryValue("purchase"),
            purchases: getActionValue("purchase"),
            impressions: apiData.impressions,
            clicks: apiData.clicks,
            cpc: apiData.cpc,
            ctr: apiData.ctr,
            costPerPurchase: apiData.spend / (getActionValue("purchase") || 1),
            addToCart: getActionValue("add_to_cart"),
            costPerAddToCart: apiData.spend / (getActionValue("add_to_cart") || 1),
            initiatedCheckouts: getActionValue("initiate_checkout"),
        };
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

    console.log(shownAds);

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
              const api = await FacebookApi.create(organizationUuid, accountId);
              return await api.getCreativeAsset(ad.creative.id);
          }),
      );

      await Promise.all(
          creativeAssets.map(async (creativeAsset, index) => {
              const { effective_instagram_media_id, effective_object_story_id } =
                  creativeAsset;
              const reportAd = reportAds[index];

              if (effective_instagram_media_id) {
                  const api = await FacebookApi.create(organizationUuid, accountId);
                  const igMedia = await api.getInstagramMedia(effective_instagram_media_id);

                  reportAd.thumbnailUrl =
                      igMedia.media_type === "IMAGE" && !igMedia.thumbnail_url
                          ? igMedia.media_url
                          : igMedia.thumbnail_url;
                  reportAd.sourceUrl = igMedia.permalink;
              } else if(effective_object_story_id) {
                  console.log("ASIDJPAOSIJHPDOAISDA")
                  const postId = effective_object_story_id.split("_")[1];
                  const api = await FacebookApi.create(organizationUuid, accountId);
                  const post = await api.getPost(postId);
                  console.log(post);
                  reportAd.thumbnailUrl =
                      post.full_picture ||
                      post.picture ||
                      "";

                  reportAd.sourceUrl = post.permalink_url || "";
              }
          }),
      );

    return reportAds;
  }
}
