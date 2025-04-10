import axios, { type AxiosInstance } from "axios";
import { Database, OrganizationToken, RedisClient } from "markly-ts-core";
import { OrganizationTokenType } from "markly-ts-core/dist/lib/enums/enums.js";

const database = await Database.getInstance();

export class FacebookReportsApi {
  private static readonly CACHE_EXPIRY = 3600;
  private constructor(
    private api: AxiosInstance,
    private organizationUuid: string,
  ) {}

  public static async create(
    organizationUuid: string,
    accountId: string,
  ): Promise<FacebookReportsApi> {
    const token = await database.em.findOne(OrganizationToken, {
      organization: organizationUuid,
      type: OrganizationTokenType.FACEBOOK,
    });

    if (!token) {
      throw new Error(
        `Access token for Organization UUID ${organizationUuid} not found`,
      );
    }

    const api = axios.create({
      baseURL: `https://graph.facebook.com/v22.0/${accountId}`,
      headers: { "Content-Type": "application/json" },
      params: { access_token: token.token },
    });

    return new FacebookReportsApi(api, organizationUuid);
  }

  public async getKpis(datePreset: string) {
    const cacheKey = `${this.organizationUuid}:${datePreset}:kpis`;
    const cached = await RedisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await this.api.get("/insights", {
      params: {
        date_preset: datePreset,
        fields:
          "account_name,account_id,spend,impressions,clicks,cpc,ctr,actions,action_values,cost_per_action_type,purchase_roas,website_purchase_roas",
        level: "account",
      },
    });

    await RedisClient.set(
      cacheKey,
      JSON.stringify(response.data),
      FacebookReportsApi.CACHE_EXPIRY,
    );
    return response.data;
  }

  public async getCampaigns(datePreset: string) {
    const cacheKey = `${this.organizationUuid}:${datePreset}:campaigns`;
    const cached = await RedisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await this.api.get("/insights", {
      params: {
        date_preset: datePreset,
        fields:
          "campaign_name,actions,clicks{outbound_clicks,all_clicks},spend,purchase_roas,website_purchase_roas,action_values{add_to_cart}",
        level: "campaign",
        limit: 1000,
      },
    });

    await RedisClient.set(
      cacheKey,
      JSON.stringify(response.data),
      FacebookReportsApi.CACHE_EXPIRY,
    );
    return response.data;
  }

  public async getGraphs(datePreset: string) {
    const cacheKey = `${this.organizationUuid}:${datePreset}:graphs`;
    const cached = await RedisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await this.api.get("/insights", {
      params: {
        date_preset: datePreset,
        fields:
          "account_name,account_id,spend,impressions,clicks,cpc,ctr,actions,action_values,cost_per_action_type,purchase_roas,website_purchase_roas",
        level: "account",
        time_increment: 1,
        limit: 1000,
      },
    });

    await RedisClient.set(
      cacheKey,
      JSON.stringify(response.data),
      FacebookReportsApi.CACHE_EXPIRY,
    );
    return response.data;
  }

  public async getRecommendations() {
    const response = await this.api.get("/recommendations");
    return response.data;
  }

  public async getAds(datePreset: string) {
    const response = await this.api.get("/ads", {
      params: {
        __cppo: 1,
        action_breakdowns: "action_type",
        fields: `id,creative{id},insights.date_preset(${datePreset}){impressions,clicks,spend,actions{action_type,value},action_values{action_type,value},purchase_roas{action_type,value}}`,
        limit: 1000,
      },
    });

    return response.data;
  }

  public async getCreativeAsset(creativeId: string) {
    const response = await axios.get(
      `https://graph.facebook.com/v22.0/${creativeId}`,
      {
        params: {
          debug: "all",
          origin_graph_explorer: 1,
          pretty: 0,
          suppress_http_code: 1,
          transport: "cors",
          thumbnail_height: 1350,
          thumbnail_width: 1080,
          __cppo: 1,
          format: "json",
          fields:
            "id,image_url,thumbnail_url,instagram_permalink_url,object_story_id",
          access_token: this.api.defaults.params.access_token,
        },
      },
    );

    return response.data;
  }

  public async getIgMedia(mediaId: string) {
    const response = await axios.get(
      `https://graph.facebook.com/v22.0/${mediaId}`,
      {
        params: {
          debug: "all",
          fields: "media_url,permalink,thumbnail_url,media_type",
          access_token: this.api.defaults.params.access_token,
        },
      },
    );

    return response.data;
  }

  public async getPost(postId: string) {
    const response = await this.api.get(`/ads`, {
      params: {
        fields:
          "id,name,adcreatives.limit(1){effective_object_story_id,name,thumbnail_url,authorization_category,instagram_permalink_url},preview_shareable_link",
        search: postId,
        limit: 1,
        thumbnail_height: 1080,
        thumbnail_width: 1080,
      },
    });

    return response.data;
  }

  public async getMe() {
    const response = await this.api.get(`/me`, {
      params: {
        fields: "id,name",
      },
    });

    return response.data;
  }

  public async getAdAccounts(postId: string) {
    const response = await this.api.get(`/ads`, {
      params: {
        fields:
          "id,name,adcreatives.limit(1){effective_object_story_id,name,thumbnail_url,authorization_category,instagram_permalink_url},preview_shareable_link",
        search: postId,
        limit: 1,
        thumbnail_height: 1080,
        thumbnail_width: 1080,
      },
    });

    return response.data;
  }
}
