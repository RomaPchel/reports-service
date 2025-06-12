import { FacebookApi, FacebookMetricPresets } from "../apis/FacebookApi.js";

export class FacebookDataUtil {

    public static async getAllReportData(
        organizationUuid: string,
        accountId: string,
        datePreset: string,
        metrics: any
    ) {
        const api = await FacebookApi.create(organizationUuid, accountId);

        const fetches: Record<string, Promise<any[]>> = {};

        fetches.ads = api.getAdInsightsWithThumbnails(
            api, datePreset
        );

        fetches.KPIs = api.getInsightsSmart(
            "account",
            metrics.kpis?.length ? metrics.kpis : FacebookMetricPresets.kpis,
            { datePreset }
        );

        fetches.campaigns = api.getInsightsSmart(
            "campaign",
            metrics.campaigns?.length ? metrics.campaigns : FacebookMetricPresets.campaigns,
            { datePreset }
        );

        fetches.graphs = api.getInsightsSmart(
            "campaign",
            metrics.graphs?.length ? metrics.graphs : FacebookMetricPresets.campaigns,
            { datePreset }
        );

        const resolved = await Promise.all(
            Object.entries(fetches).map(([key, promise]) =>
                promise.then((data) => [key, data])
            )
        );

        const result: Record<string, any> = Object.fromEntries(resolved);

        const processedAds = result.ads
            ? await this.processAds(result.ads, organizationUuid, accountId)
            : [];

        return {
            ads: processedAds,
            KPIs: result.KPIs?.length ? this.normalizeKPIs(result.KPIs[0]) : null,
            campaigns: result.campaigns ? this.normalizeCampaigns(result.campaigns) : [],
            graphs: result.graphs ? this.normalizeGraphs(result.graphs) : [],
        };
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
            const purchasesAction = actions.find((a: { action_type: string }) => a.action_type === "purchase");
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
        if (!apiData) return [];

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
            .filter((ad) => ad.impressions)
            .sort((a, b) => {
                const roasA = parseFloat(a.impressions);
                const roasB = parseFloat(b.impressions);
                return roasB - roasA;
            })
            .slice(0, 10);
    }

    private static async processAds(
        ads: any[],
        organizationUuid: string,
        accountId: string
    ) {
        const shownAds = this.getBest10AdsByROAS(ads);
        const api = await FacebookApi.create(organizationUuid, accountId);

        const reportAds = shownAds.map((ad) => {
            const getActionValue = (type: string) =>
                ad.actions?.find((a: any) => a.action_type === type)?.value ?? "0";

            return {
                adId: ad.ad_id,
                adCreativeId: null,
                thumbnailUrl: "",
                spend: ad.spend,
                addToCart: getActionValue("add_to_cart"),
                purchases: getActionValue("purchase"),
                roas: ad.purchase_roas?.[0]?.value || "0",
                sourceUrl: "",
            };
        });

        const adIds = shownAds.map((a) => a.ad_id).filter(Boolean);
        const adEntities = await api.getEntitiesBatch(adIds, ["id", "creative{id}"]);

        const creativeIds = adEntities
          .map((ad: { creative: { id: any } }) => ad.creative?.id)
          .filter((id: any): id is string => !!id);

        const creativeAssets = await api.getEntitiesBatch(creativeIds, [
            "id",
            "effective_instagram_media_id",
            "effective_object_story_id",
            "thumbnail_url",
            "instagram_permalink_url"
        ]);

        reportAds.forEach((reportAd) => {
            const adEntity = adEntities.find(
              (a: { id: any }) => a.id === reportAd.adId,
            );
            reportAd.adCreativeId = adEntity?.creative?.id || null;
        });

        await Promise.all(reportAds.map(async (reportAd) => {
            const creativeAsset = creativeAssets.find(
              (c: { id: string }) => c.id === reportAd.adCreativeId,
            );
            if (!creativeAsset) return;

            const {
                effective_instagram_media_id,
                effective_object_story_id,
                thumbnail_url,
                instagram_permalink_url
            } = creativeAsset;

            if (effective_instagram_media_id) {
                const igMedia = await api.getInstagramMedia(effective_instagram_media_id);
                reportAd.thumbnailUrl = igMedia.media_type === "IMAGE" && !igMedia.thumbnail_url
                    ? igMedia.media_url
                    : igMedia.thumbnail_url;
                reportAd.sourceUrl = igMedia.permalink;
            } else if (effective_object_story_id) {
                const postId = effective_object_story_id.split("_")[1];
                const post = await api.getPost(postId);
                reportAd.thumbnailUrl = post.adcreatives?.data?.[0]?.thumbnail_url || thumbnail_url || "";
                reportAd.sourceUrl = post.permalink_url || instagram_permalink_url || "";
            } else {
                reportAd.thumbnailUrl = thumbnail_url || "";
            }
        }));

        return reportAds;
    }
}
