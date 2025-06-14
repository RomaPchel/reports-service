import { FacebookApi, FacebookMetricPresets } from "../apis/FacebookApi.js";

export interface ReportData {
    ads: any[];
    KPIs: KPIs | null;
    campaigns: any[];
    graphs: Graph[];
}

export interface KPIs {
    spend?: number;
    impressions?: number;
    clicks?: number;
    cpc?: number;
    ctr?: number;
    cpm?: number;
    cpp?: number;
    reach?: number;
    purchase_roas?: number;
    purchases?: number;
    add_to_cart?: number;
    initiated_checkouts?: number;
    conversion_value?: number;
    cost_per_purchase?: number;
    cost_per_add_to_cart?: number;
    conversion_rate?: number;
    engagement?: number;
}

export interface Graph {
    spend?: number;
    impressions?: number;
    clicks?: number;
    cpc?: number;
    ctr?: number;
    cpm?: number;
    cpp?: number;
    reach?: number;
    purchase_roas?: number;
    purchases?: number;
    add_to_cart?: number;
    initiated_checkouts?: number;
    conversion_value?: number;
    cost_per_purchase?: number;
    cost_per_add_to_cart?: number;
    conversion_rate?: number;
    engagement?: number;
    date_start: string;
    date_stop: string;
}

export interface Ad {
    adId: string;
    adCreativeId: string;
    thumbnailUrl: string;
    sourceUrl: string;
    
    spend?: number;
    impressions?: number;
    clicks?: number;
    cpc?: number;
    ctr?: number;
    cpm?: number;
    cpp?: number;
    reach?: number;
    purchase_roas?: number;
    purchases?: number;
    add_to_cart?: number;
    initiated_checkouts?: number;
    conversion_value?: number;
    cost_per_purchase?: number;
    cost_per_add_to_cart?: number;
    conversion_rate?: number;
    engagement?: number;
}

const FB_NATIVE_FIELDS = new Set([
    "spend", "impressions", "clicks", "cpc", "ctr", "cpm", "cpp", "reach",
    "purchase_roas", "actions", "action_values", "date_start", "date_stop",
    "campaign_id", "campaign_name", "ad_id", "account_id"
]);
 
export const AVAILABLE_KPI_METRICS: Record<string, string[]> = {
    spend: ['spend'],
    impressions: ['impressions'],
    clicks: ['clicks'],
    cpc: ['cpc'],
    ctr: ['ctr'],
    cpm: ['cpm'],
    cpp: ['cpp'],
    reach: ['reach'],
    purchase_roas: ['purchase_roas'],

    conversion_value: ['action_values'],

    purchases: ['actions'],
    add_to_cart: ['actions'],
    initiated_checkouts: ['actions'],
    engagement: ['actions'],
    
    cost_per_purchase: ['spend', 'actions'],
    cost_per_add_to_cart: ['spend', 'actions'],
    conversion_rate: ['clicks', 'actions'],
}

type AvailableKpiMetric = keyof typeof AVAILABLE_KPI_METRICS;

export const AVAILABLE_GRAPH_METRICS: Record<string, string[]> = {
    spend: ['spend'],
    impressions: ['impressions'],
    clicks: ['clicks'],
    cpc: ['cpc'],
    ctr: ['ctr'],
    cpm: ['cpm'],
    cpp: ['cpp'],
    reach: ['reach'],
    purchase_roas: ['purchase_roas'],

    conversion_value: ['action_values'],

    purchases: ['actions'],
    add_to_cart: ['actions'],
    initiated_checkouts: ['actions'],
    engagement: ['actions'],
    
    cost_per_purchase: ['spend', 'actions'],
    cost_per_add_to_cart: ['spend', 'actions'],
    conversion_rate: ['clicks', 'actions']
}

type AvailableGraphMetric = keyof typeof AVAILABLE_GRAPH_METRICS;

export const AVAILABLE_ADS_METRICS: Record<string, string[]> = {
    spend: ['spend'], //
    impressions: ['impressions'], //
    clicks: ['clicks'], // 
    cpc: ['cpc'], //
    ctr: ['ctr'], //
    cpm: ['cpm'],
    cpp: ['cpp'],
    reach: ['reach'],
    purchase_roas: ['purchase_roas'], //

    conversion_value: ['action_values'], //

    purchases: ['actions'], //
    add_to_cart: ['actions'], //
    initiated_checkouts: ['actions'], //
    engagement: ['actions'], //
    
    cost_per_purchase: ['spend', 'actions'],
    cost_per_add_to_cart: ['spend', 'actions'],
    conversion_rate: ['clicks', 'actions']
}

type AvailableAdMetric = keyof typeof AVAILABLE_ADS_METRICS;

export interface AvailableMetrics {
    kpis: AvailableKpiMetric[];
    graphs: AvailableGraphMetric[];
    ads: AvailableAdMetric[];
    campaigns: string[];
}

export class FacebookDataUtil {

    static determineAdsFieldsBasedOnSelectedMetrics(selectedMetrics: string[]): string[] {
        const metrics = selectedMetrics.map(metric => AVAILABLE_ADS_METRICS[metric]).flat();
        return [...new Set(metrics)];
    }

    public static async getAllReportData(
        organizationUuid: string,
        accountId: string,
        datePreset: string,
        metrics: AvailableMetrics
    ): Promise<ReportData> {
        const api = await FacebookApi.create(organizationUuid, accountId);

        const fetches: Record<string, Promise<any[]>> = {};

        const selectedKpiMetrics: string[] = metrics.kpis?.length ? metrics.kpis : [];
        const kpiApiFields = this.determineKpisFieldsBasedOnSelectedMetrics(selectedKpiMetrics);

        const selectedAdsMetrics: string[] = metrics.ads?.length ? metrics.ads : [];
        const adsApiFields = this.determineAdsFieldsBasedOnSelectedMetrics(selectedAdsMetrics);

        const campaignMetrics = metrics.campaigns?.length ? metrics.campaigns : FacebookMetricPresets.campaigns;
        const campaignApiFields = campaignMetrics.filter((m: string) => FB_NATIVE_FIELDS.has(m));

        const obligatoryGraphsMetrics = ["date_start", "date_stop"];
        const selectedGraphsMetrics = metrics.graphs?.length ? 
            [ ...metrics.graphs, ...obligatoryGraphsMetrics ] : [];
        const graphApiFields = this.determineGraphFieldsBasedOnSelectedMetrics(selectedGraphsMetrics);

        if (selectedKpiMetrics.length) fetches.KPIs = api.getInsightsSmart("account", kpiApiFields, { datePreset });

        if (metrics.ads?.length) fetches.ads = api.getAdInsightsWithThumbnails(api, adsApiFields, datePreset);

        if (metrics.campaigns?.length) fetches.campaigns = api.getInsightsSmart("campaign", campaignApiFields, { datePreset });

        if (selectedGraphsMetrics.length) fetches.graphs = api.getInsightsSmart("account", graphApiFields, { datePreset, timeIncrement: 1 });

        const resolved = await Promise.all(
            Object.entries(fetches).map(([key, promise]) =>
                promise.then((data) => [key, data])
            )
        );

        const result: Record<string, any> = Object.fromEntries(resolved);

        const ads = result.ads ? await this.processAds(result.ads, selectedAdsMetrics, organizationUuid, accountId) : [];

        const reportData: ReportData = {
            ads: ads,
            KPIs: result.KPIs?.length ? this.normalizeKPIs(result.KPIs[0], selectedKpiMetrics) : null,
            campaigns: result.campaigns ? this.normalizeCampaigns(result.campaigns, campaignMetrics) : [],
            graphs: result.graphs ? this.normalizeGraphs(result.graphs, selectedGraphsMetrics) : [],
        };

        return reportData;
    }

    static determineKpisFieldsBasedOnSelectedMetrics(selectedMetrics: string[]): string[] {
        const metrics = selectedMetrics.map(metric => AVAILABLE_KPI_METRICS[metric]).flat();
        return [...new Set(metrics)];
    }

    private static normalizeKPIs(apiData: any, selectedMetrics: any[]): KPIs | null {
        if (!apiData) return null;

        const getActionValue = (type: string): number =>
            Number(apiData.actions?.find((a: any) => a.action_type === type)?.value || 0);

        const getActionMonetaryValue = (type: string): number =>
            Number(apiData.action_values?.find((a: any) => a.action_type === type)?.value || 0);

        const purchases = getActionValue("omni_purchase");
        const add_to_cart = getActionValue("omni_add_to_cart");
        const initiated_checkouts = getActionValue("initiate_checkout");
        const conversion_value = getActionMonetaryValue("omni_purchase");

        const allMetrics: KPIs = {
            spend: apiData.spend,
            impressions: apiData.impressions,
            clicks: apiData.clicks,
            cpc: apiData.cpc,
            ctr: apiData.ctr,
            cpm: apiData.cpm,
            cpp: apiData.cpp,
            reach: apiData.reach,
            purchase_roas: apiData.purchase_roas?.[0]?.value || 0,
            purchases,
            add_to_cart,
            initiated_checkouts,
            conversion_value,

            cost_per_purchase: purchases > 0 ? (apiData.spend / purchases) : 0,
            cost_per_add_to_cart: add_to_cart > 0 ? (apiData.spend / add_to_cart) : 0,
            conversion_rate: apiData.clicks > 0 ? (purchases / apiData.clicks) * 100 : 0,
            engagement: getActionValue("post_engagement") || getActionValue("page_engagement") || 0
        };

        const filteredMetrics = Object.fromEntries(
            Object.entries(allMetrics)
                .filter(([key]) => selectedMetrics.includes(key as AvailableKpiMetric)) // leave only selected metrics
                .filter(([_, value]) => value !== undefined)
        );

        return filteredMetrics;
    }

    private static normalizeGraphs(graphs: any[], metrics: string[]) {
        return graphs.map((g) => {
            const spend = parseFloat(g.spend || "0");
            const clicks = parseInt(g.clicks || "0");
            const impressions = parseInt(g.impressions || "0");

            const actions: Record<string, number> = Object.fromEntries(
                (g.actions || []).map((a: any) => [a.action_type, Number(a.value)])
            );

            const getActionValue = (type: string): number => actions[type] || 0;

            const getActionMonetaryValue = (type: string): number =>
                Number(g.action_values?.find((a: any) => a.action_type === type)?.value || 0);

            const purchases = getActionValue("omni_purchase");
            const add_to_cart = getActionValue("omni_add_to_cart");
            const initiated_checkouts = getActionValue("initiate_checkout");
            const conversion_value = getActionMonetaryValue("omni_purchase");

            const graph: Graph = {
                spend,
                impressions,
                clicks,
                cpc: g.cpc,
                ctr: g.ctr,
                cpm: g.cpm,
                cpp: g.cpp,
                reach: g.reach,
                purchase_roas: g.purchase_roas?.[0]?.value || 0,
                purchases,
                add_to_cart,
                initiated_checkouts,
                conversion_value,

                cost_per_purchase: purchases > 0 ? (spend / purchases) : 0,
                cost_per_add_to_cart: add_to_cart > 0 ? (spend / add_to_cart) : 0,
                conversion_rate: clicks > 0 ? (purchases / clicks) * 100 : 0,
                engagement: getActionValue("post_engagement") || getActionValue("page_engagement") || 0,

                date_start: g.date_start,
                date_stop: g.date_stop,
            };

            return Object.fromEntries(
                metrics.map((key) => [key, graph[key as keyof Graph]]).filter(([, value]) => value !== undefined)
            );
        });
    }

    static determineGraphFieldsBasedOnSelectedMetrics(selectedMetrics: string[]): string[] {
        let metrics = selectedMetrics.map(metric => {
            if (AVAILABLE_GRAPH_METRICS[metric]) {
                return AVAILABLE_GRAPH_METRICS[metric]
            }
            return [metric];
        }).flat();
        return [...new Set(metrics)];
    }

    private static normalizeCampaigns(campaigns: any[], metrics: string[]): any[] {
        const results: any[] = [];

        for (const [index, c] of campaigns.entries()) {
            const actions = c.actions || [];

            const getActionValue = (type: string): number =>
                Number(actions.find((a: any) => a.action_type === type)?.value || 0);

            const getActionMonetaryValue = (type: string): number =>
                Number(c.action_values?.find((a: any) => a.action_type === type)?.value || 0);

            const spend = Number(c.spend || 0);
            const clicks = Number(c.clicks || 0);
            const purchases = getActionValue("purchase");

            const allMetrics: Record<string, any> = {
                index,
                campaign_name: c.campaign_name,
                spend: spend,
                purchases: purchases,
                clicks: clicks,
                impressions: Number(c.impressions || 0),
                ctr: Number(c.ctr || 0),
                purchaseRoas: Number(c.purchase_roas?.[0]?.value || 0),
                conversionValue: getActionMonetaryValue("purchase"),

                costPerPurchase: purchases > 0 ? spend / purchases : 0,
                conversionRate: clicks > 0 ? (purchases / clicks) * 100 : 0,
            };

            const entry = Object.fromEntries(
                metrics
                    .map(key => {
                        const value = typeof allMetrics[key] === "function"
                            ? allMetrics[key]()
                            : allMetrics[key];
                        return [key, value];
                    })
                    .filter(([, value]) => value !== undefined)
            );

            results.push(entry);
        }

        return results;
    }

    private static getBest10AdsByROAS(ads: any[], metric: string): any[] {
        return ads
            .filter((ad) => ad[metric])
            .sort((a, b) => {
                const roasA = parseFloat(a[metric]);
                const roasB = parseFloat(b[metric]);
                return roasB - roasA;
            })
            .slice(0, 10);
    }

    private static async processAds(
        ads: any[],
        selectedMetrics: string[],
        organizationUuid: string,
        accountId: string
    ) {
        const defaultAdKeys = ["adId", "adCreativeId", "thumbnailUrl", "sourceUrl"];
        const shownAds = this.getBest10AdsByROAS(ads, "impressions");
        const api = await FacebookApi.create(organizationUuid, accountId);

        const reportAds = shownAds.map((ad) => {
            const getActionValue = (type: string) =>
                ad.actions?.find((a: any) => a.action_type === type)?.value ?? "0";

            const getActionMonetaryValue = (type: string): number =>
                Number(ad.action_values?.find((a: any) => a.action_type === type)?.value || 0);

            const purchases = getActionValue("omni_purchase");
            const add_to_cart = getActionValue("omni_add_to_cart");
            const initiated_checkouts = getActionValue("initiate_checkout");
            const conversion_value = getActionMonetaryValue("omni_purchase");

            const adObject: Ad = {
                adId: ad.ad_id,
                adCreativeId: "",
                thumbnailUrl: "",
                sourceUrl: "",
                
                spend: ad.spend,
                impressions: ad.impressions,
                clicks: ad.clicks,
                cpc: ad.cpc,
                ctr: ad.ctr,
                cpm: ad.cpm,
                cpp: ad.cpp,
                reach: ad.reach,
                purchase_roas: ad.purchase_roas?.[0]?.value || 0,
                purchases,
                add_to_cart,
                initiated_checkouts,
                conversion_value,

                cost_per_purchase: purchases > 0 ? (ad.spend / purchases) : 0,
                cost_per_add_to_cart: add_to_cart > 0 ? (ad.spend / add_to_cart) : 0,
                conversion_rate: ad.clicks > 0 ? (purchases / ad.clicks) * 100 : 0,
                engagement: getActionValue("post_engagement") || getActionValue("page_engagement") || 0
            };

            return adObject;
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
        
        const finalFields = [...defaultAdKeys, ...selectedMetrics];
        reportAds.forEach((adObject: any) => {
            Object.keys(adObject).forEach((key: string) => {
                if (!finalFields.includes(key)) {
                    delete adObject[key];
                }
            });
        });

        return reportAds;
    }
}
