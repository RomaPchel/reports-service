import axios, { type AxiosInstance } from "axios";
import { Database, OrganizationToken } from "marklie-ts-core";

const database = await Database.getInstance();

export const FacebookMetricPresets = {
  kpis: [
    'account_name',
    'account_id',
    'spend',
    'impressions',
    'clicks',
    'cpc',
    'ctr',
    'actions',
    'action_values',
    'purchase_roas',
    'reach',
  ],
  adPerformance: [
    'id',
    'name',
    'status',
    'creative{id}',
    'insights.date_preset(last_7d){impressions,clicks,spend,actions{action_type,value},purchase_roas{action_type,value}}'
  ],
  campaigns: [
    'campaign_id',
    'campaign_name',
    'spend',
    'impressions',
    'clicks',
    'ctr',
    'actions'
  ],
};

export class FacebookApi {
  private api: AxiosInstance;

  private constructor(
      token: string,
      private accountId: string
  ) {
    this.api = axios.create({
      baseURL: `https://graph.facebook.com/v22.0/`,
      params: {
        access_token: token,
      },
    });
  }

  static async create(
      organizationUuid: string,
      accountId: string
  ): Promise<FacebookApi> {
    const tokenRecord = await database.em.findOne(OrganizationToken, {
      organization: organizationUuid,
    });

    if (!tokenRecord) {
      throw new Error(`No token found for organizationUuid with UUID ${organizationUuid}`);
    }

    return new FacebookApi(tokenRecord.token, accountId);
  }

  private async batchRequest(batch: { method: string; relative_url: string }[]) {
    const res = await this.api.post("/", null, {
      params: {
        batch: JSON.stringify(batch),
      },
    });
    return res.data.map((item: any) => JSON.parse(item.body));
  }

  public async getEntitiesBatch(entityIds: string[], fields: string[]) {
    const batch = entityIds.map((id) => ({
      method: "GET",
      relative_url: `${id}?fields=${fields.join(",")}`,
    }));
    return await this.batchRequest(batch);
  }

  public async getAdAccountInfo(fields: string[] = ['name', 'id', 'account_status', 'business', 'timezone_name']) {
    const res = await this.api.get(`${this.accountId}`, {
      params: { fields: fields.join(",") },
    });
    return res.data;
  }

  public async getCampaigns(datePreset: string = 'last_7d', fields: string[] = FacebookMetricPresets.campaigns) {
    const res = await this.api.get(`${this.accountId}/insights`, {
      params: {
        date_preset: datePreset,
        fields: fields.join(","),
        level: "campaign",
        limit: 1000,
      },
    });
    return res.data.data as any[];
  }

  public async getAdSets(fields: string[] = ['id', 'name', 'status', 'campaign_id', 'budget_remaining', 'targeting']) {
    const res = await this.api.get(`${this.accountId}/adsets`, {
      params: {
        fields: fields.join(","),
      },
    });
    return res.data;
  }

  public async getAds(datePreset = "last_7d", fields: string[] = FacebookMetricPresets.adPerformance) {
     const res = await this.api.get(`${this.accountId}/ads`, {
       params: {
         date_preset: datePreset,
         fields: fields.join(","),
         limit: 1000,
         __cppo: 1,
         action_breakdowns: "action_type",
       },
     });
     return res.data;
  }

  public async getAccountInsights(datePreset = "last_7d", fields: string[] = FacebookMetricPresets.kpis) {
    const res = await this.api.get(`${this.accountId}/insights`, {
      params: {
        date_preset: datePreset,
        fields: fields.join(","),
        level: "account",
      },
    });
    return res.data.data as any[];
  }

  public async getCampaignInsights(datePreset = "last_7d", fields: string[] = FacebookMetricPresets.campaigns) {
    const res = await this.api.get(`${this.accountId}/insights`, {
      params: {
        level: "campaign",
        date_preset: datePreset,
        fields: fields.join(","),
      },
    });
    return res.data.data as any[];
  }

  public async getAdSetInsights(fields: string[] = ['adset_id', 'adset_name', 'spend', 'impressions', 'reach', 'frequency', 'actions'], datePreset = "last_7d") {
    const res = await this.api.get(`${this.accountId}/insights`, {
      params: {
        level: "adset",
        date_preset: datePreset,
        fields: fields.join(","),
      },
    });
    return res.data;
  }

  public async getCreativeAssetsBatch(creativeIds: string[]) {
    return await this.getEntitiesBatch(creativeIds, [
      'id',
      'effective_instagram_media_id',
      'effective_object_story_id',
      'thumbnail_url',
      'instagram_permalink_url'
    ]);
  }

  public async getInstagramMediaBatch(mediaIds: string[]) {
    return await this.getEntitiesBatch(mediaIds, [
      'media_url',
      'permalink',
      'thumbnail_url',
      'media_type'
    ]);
  }

  public async getAdCreatives(fields: string[] = ['id', 'name', 'object_story_id', 'thumbnail_url', 'effective_object_story_id']) {
    const res = await this.api.get(`${this.accountId}/adcreatives`, {
      params: { fields: fields.join(",") },
    });
    return res.data;
  }

  public async getCreativeAsset(creativeId: string, fields: string[] = ['id', 'image_url', 'thumbnail_url', 'instagram_permalink_url', 'effective_object_story_id']) {
     const res = await this.api.get(`${creativeId}`, {
       params: { fields: fields.join(",") },
     });
     return res.data;
  }

  public async getInstagramMedia(mediaId: string, fields: string[] = ['media_url', 'permalink', 'thumbnail_url', 'media_type']) {
    const res = await this.api.get(`${mediaId}`, {
      params: { fields: fields.join(",") },
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

  public async getRecommendations() {
    const res = await this.api.get(`${this.accountId}/recommendations`);
    return res.data;
  }

  public async getTargetingDemographics() {
    const res = await this.api.get(`${this.accountId}/reachestimate`, {
      params: {
        targeting_spec: JSON.stringify({
          geo_locations: { countries: ["US"] },
          age_min: 18,
          age_max: 65,
        }),
      },
    });
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
    const res = await this.api.get(`/me/adaccounts`, {
      params: { fields: "id,name" },
    });
    return res.data;
  }

  public async getFilteredAdAccounts() {
    const businesses = await this.getBusinesses();
    const allAdAccounts = await this.getUserAdAccounts();

    const businessAccountIds = new Set<string>();
    for (const business of businesses.data) {
      const accounts = business.owned_ad_accounts?.data || [];
      accounts.forEach((acc: { id: string; name: string }) =>
          businessAccountIds.add(acc.id)
      );
    }

    return allAdAccounts.data.filter(
        (acc: any) => !businessAccountIds.has(acc.id)
    );
  }

  public async getProfile() {
    const res = await this.api.get(`/me`, {
      params: { fields: "id,name,email,picture" },
    });
    return res.data;
  }
}
