import axios, { type AxiosInstance } from "axios";
import { Database, OrganizationToken } from "marklie-ts-core";
import {Log} from "marklie-ts-core/dist/lib/classes/Logger.js";

const database = await Database.getInstance();
const logger = Log.getInstance().extend("facebook-api");

export const FacebookMetricPresets = {
  kpis: [
    'account_name', 'account_id', 'spend', 'impressions', 'clicks', 'cpc', 'ctr', 'actions', 'action_values', 'purchase_roas', 'reach'
  ],
  adPerformance: [
    'id',
    'ad_id',
    'name',
    'status',
    'campaign_id',
    'adset_id',
    'account_id',
    'created_time',
    'updated_time',
    'effective_status',
    'configured_status',
    'creative{id,name,thumbnail_url,object_story_id,effective_object_story_id}',

    'spend',
    'purchase_roas',

    'insights.date_preset(last_90d){' +
    'date_start,date_stop,' +
    'impressions,clicks,spend,reach,frequency,' +
    'cpc,ctr,cpm,cpp,' +
    'actions{action_type,value},' +
    'action_values{action_type,value},' +
    'purchase_roas{action_type,value}' +
    '}'  ],
  campaigns: [
    'campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks', 'ctr', 'actions'
  ],
  adInsights: [
    'ad_id',
    'impressions',
    'clicks',
    'spend',
    'actions',
    'action_values',
    'purchase_roas'
  ]
};

export class FacebookApi {
  private readonly MAX_POLL_ATTEMPTS = 20;
  private readonly POLL_INTERVAL_MS = 3000;

  private api: AxiosInstance;

  private constructor(token: string, private accountId: string) {
    this.api = axios.create({
      baseURL: `https://graph.facebook.com/v22.0/`,
      params: { access_token: token },
    });
  }

  static async create(organizationUuid: string, accountId: string): Promise<FacebookApi> {
    const tokenRecord = await database.em.findOne(OrganizationToken, { organization: organizationUuid });
    if (!tokenRecord) throw new Error(`No token found for organizationUuid ${organizationUuid}`);
    console.log(tokenRecord.token)
    return new FacebookApi(tokenRecord.token, accountId);
  }

  private async batchRequest(batch: { method: string; relative_url: string }[]) {
    const res = await this.api.post("/", null, {
      params: { batch: JSON.stringify(batch) },
    });
    return res.data.map((item: any) => JSON.parse(item.body));
  }

  public async getEntitiesBatch(entityIds: string[], fields: string[]) {
    const batch = entityIds.map((id) => ({ method: "GET", relative_url: `${id}?fields=${fields.join(",")}` }));
    return await this.batchRequest(batch);
  }

  public async getInsightsSmart(
      level: "account" | "campaign" | "adset" | "ad",
      fields: string[],
      options: {
        datePreset?: string;
        customDateRange?: { since: string; until: string };
        breakdowns?: string[];
        actionBreakdowns?: string[];
      } = {}
  ): Promise<any[]> {
    const {
      datePreset = "last_7d",
      customDateRange,
      breakdowns = [],
      actionBreakdowns = [],
    } = options;

    const hasNestedInsights = fields.some((f) =>
        f.includes("insights{") || f.includes("insights.date_preset")
    );


    const isLargeQuery =
        customDateRange ||
        breakdowns.length > 0 ||
        actionBreakdowns.length > 0 ||
        !["today", "yesterday", "last_7d"].includes(datePreset);

    const useAdsEndpoint = level === "ad" && hasNestedInsights;
    const useInsightsEndpoint = !useAdsEndpoint;

    const commonParams: Record<string, any> = {
      fields: fields.join(","),
      ...(customDateRange ? { time_range: customDateRange } : { date_preset: datePreset }),
      __cppo: 1,
      actionBreakdowns: ['action_type']
    };

    if (useInsightsEndpoint) {
      commonParams.level = level;
      if (breakdowns.length) commonParams.breakdowns = breakdowns.join(",");
      if (actionBreakdowns.length) commonParams.action_breakdowns = actionBreakdowns.join(",");
    }

    const endpoint = useAdsEndpoint
        ? `${this.accountId}/ads`
        : `${this.accountId}/insights`;

    logger.info(`Fetching insights from ${endpoint} with params: ${JSON.stringify(commonParams)}`);

    if (!isLargeQuery || useAdsEndpoint) {
        const res = await this.api.get(endpoint, {
          params: { ...commonParams, limit: 100 },
        });

        return res.data.data || [];
    }

    const jobRes = await this.api.post(endpoint, null, {
      params: { ...commonParams, async: true },
    });

    const reportId = jobRes.data.report_run_id;
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    for (let i = 0; i < this.MAX_POLL_ATTEMPTS; i++) {
      const statusRes = await this.api.get(`/${reportId}`);
      if (statusRes.data.async_status === "Job Completed") {
        const dataRes = await this.api.get(`/${reportId}/insights`);
        return dataRes.data.data || [];
      }
      if (statusRes.data.async_status === "Job Failed") {
        throw new Error("Facebook Insights async job failed");
      }
      await delay(this.POLL_INTERVAL_MS);
    }

    throw new Error("Facebook Insights async job timed out");
  }

  public async getAdCreatives(fields: string[] = ['id', 'name', 'object_story_id', 'thumbnail_url', 'effective_object_story_id']) {
    const res = await this.api.get(`${this.accountId}/adcreatives`, { params: { fields: fields.join(",") } });
    return res.data;
  }

  public async getCreativeAssetsBatch(creativeIds: string[]) {
    return await this.getEntitiesBatch(creativeIds, [
      'id', 'effective_instagram_media_id', 'effective_object_story_id', 'thumbnail_url', 'instagram_permalink_url'
    ]);
  }

  public async getInstagramMediaBatch(mediaIds: string[]) {
    return await this.getEntitiesBatch(mediaIds, [
      'media_url', 'permalink', 'thumbnail_url', 'media_type'
    ]);
  }

  public async getCreativeAsset(creativeId: string, fields: string[] = ['id', 'image_url', 'thumbnail_url', 'instagram_permalink_url', 'effective_object_story_id']) {
    const res = await this.api.get(`${creativeId}`, { params: { fields: fields.join(",") } });
    return res.data;
  }

  public async getInstagramMedia(mediaId: string, fields: string[] = ['media_url', 'permalink', 'thumbnail_url', 'media_type']) {
    const res = await this.api.get(`${mediaId}`, { params: { fields: fields.join(",") } });
    return res.data;
  }

  public async getProfile() {
    const res = await this.api.get(`/me`, { params: { fields: "id,name,email,picture" } });
    return res.data;
  }

  public async getBusinesses() {
    const res = await this.api.get(`/me/businesses`, {
      params: {
        fields: "id,name,owned_ad_accounts{id,name}",
        limit: 1000,
      },
    });
    return res.data;
  }

  public async getUserAdAccounts() {
    const res = await this.api.get(`/me/adaccounts`, { params: { fields: "id,name" } });
    return res.data;
  }

  public async getFilteredAdAccounts() {
    const businesses = await this.getBusinesses();
    const allAdAccounts = await this.getUserAdAccounts();
    const businessAccountIds = new Set<string>();
    for (const business of businesses.data) {
      const accounts = business.owned_ad_accounts?.data || [];
      accounts.forEach((acc: { id: string; name: string }) => businessAccountIds.add(acc.id));
    }
    return allAdAccounts.data.filter((acc: any) => !businessAccountIds.has(acc.id));
  }

  public async getRecommendations() {
    const res = await this.api.get(`${this.accountId}/recommendations`);
    return res.data;
  }

  public async getTargetingDemographics() {
    const res = await this.api.get(`${this.accountId}/reachestimate`, {
      params: {
        targeting_spec: JSON.stringify({ geo_locations: { countries: ["US"] }, age_min: 18, age_max: 65 }),
      },
    });
    return res.data;
  }

  public async getPost(postId: string) {
    const res = await this.api.get(`${this.accountId}`, {
      params: {
        fields:
            "id,name,adcreatives.limit(1){effective_object_story_id,name,thumbnail_url,authorization_category,instagram_permalink_url}",
        search: postId,
        limit: 1,
        thumbnail_height: 1080,
        thumbnail_width: 1080,
      },
    });
    return res.data;
  }
}