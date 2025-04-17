import axios, { type AxiosInstance } from "axios";
import { Database, OrganizationToken } from "markly-ts-core";

const database = await Database.getInstance();

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

  private async batchRequest(batch: any[]) {
    const res = await this.api.post("/", null, {
      params: {
        batch: JSON.stringify(batch),
      },
    });
    return res.data.map((item: any) => JSON.parse(item.body));
  }

  public async getAdAccountInfo() {
    const res = await this.api.get(`${this.accountId}`, {
      params: { fields: "name,id,account_status,business,timezone_name" },
    });
    return res.data;
  }

  public async getCampaigns(datePreset: string) {
    const res = await this.api.get(`${this.accountId}/insights`, {
      params: {
        date_preset: datePreset,
        fields:
            "campaign_name,actions,clicks{outbound_clicks,all_clicks},spend,purchase_roas,website_purchase_roas,action_values{add_to_cart}",
        level: "campaign",
        limit: 1000,
      },
    });
    return res.data.data as any[];
  }

  public async getAdSets() {
    const res = await this.api.get(`${this.accountId}/adsets`, {
      params: {
        fields: "id,name,status,campaign_id,budget_remaining,targeting",
      },
    });
    return res.data;
  }

  public async getAds(datePreset = "last_7d") {
    const res = await this.api.get(`${this.accountId}/ads`, {
      params: {
        __cppo: 1,
        action_breakdowns: "action_type",
        fields:
            "id,creative{id},insights.date_preset(" +
            datePreset +
            "){impressions,clicks,spend,actions{action_type,value},action_values{action_type,value},purchase_roas{action_type,value}}",
        limit: 1000,
      },
    });
    return res.data;
  }

  public async getAccountInsights(datePreset = "last_7d") {
    const res = await this.api.get(`${this.accountId}/insights`, {
      params: {
        date_preset: datePreset,
        fields:
            "account_name,account_id,spend,impressions,clicks,cpc,ctr,actions,action_values,purchase_roas,reach",
      },
    });
    return res.data.data as any[];
  }

  public async getCampaignInsights(datePreset = "last_7d") {
    const res = await this.api.get(`${this.accountId}/insights`, {
      params: {
        level: "campaign",
        date_preset: datePreset,
        fields:
            "campaign_id,campaign_name,spend,impressions,clicks,ctr,actions",
      },
    });
    return res.data.data as any[];
  }

  public async getAdSetInsights(datePreset = "last_7d") {
    const res = await this.api.get(`${this.accountId}/insights`, {
      params: {
        level: "adset",
        date_preset: datePreset,
        fields: "adset_id,adset_name,spend,impressions,reach,frequency,actions",
      },
    });
    return res.data;
  }

  public async getCreativeAssetsBatch(creativeIds: string[]) {
    const batch = creativeIds.map((id) => ({
      method: "GET",
      relative_url: `${id}?fields=id,effective_instagram_media_id,effective_object_story_id,thumbnail_url,instagram_permalink_url`,
    }));
    return await this.batchRequest(batch);
  }

  public async getInstagramMediaBatch(mediaIds: string[]) {
    const batch = mediaIds.map((id) => ({
      method: "GET",
      relative_url: `${id}?fields=media_url,permalink,thumbnail_url,media_type`,
    }));
    return await this.batchRequest(batch);
  }

  public async getAdCreatives() {
    const res = await this.api.get(`${this.accountId}/adcreatives`, {
      params: {
        fields: "id,name,object_story_id,thumbnail_url,effective_object_story_id",
      },
    });
    return res.data;
  }

  public async getCreativeAsset(creativeId: string) {
    const res = await this.api.get(`${creativeId}`, {
      params: {
        fields:
            "id,image_url,image_hash,creative_sourcing_spec,video_id,playable_asset_id,object_id,thumbnail_url,instagram_permalink_url,effective_instagram_media_id,effective_object_story_id",
      },
    });
    return res.data;
  }

  public async getInstagramMedia(mediaId: string) {
    const res = await this.api.get(`${mediaId}`, {
      params: {
        fields: "media_url,permalink,thumbnail_url,media_type",
      },
    });
    return res.data;
  }

  public async getPost(postId: string) {
    const res = await this.api.get(`${postId}`, {
      params: {
        fields: ["id", "permalink_url", "picture", "created_time"].join(","),
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
      params: {
        fields: "id,name",
      },
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
      params: {
        fields: "id,name,email,picture",
      },
    });
    return res.data;
  }
}
