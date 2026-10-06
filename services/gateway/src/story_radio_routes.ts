import Type from "typebox";
import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { StoryRadioError, type StoryRadioService } from "./story_radio.js";

const SeriesId = Type.String({ minLength: 1, maxLength: 128 });
const EpisodeId = Type.String({ minLength: 1, maxLength: 128 });
const NullableString = Type.Union([Type.String(), Type.Null()]);
const SeriesBody = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.String({ maxLength: 4000 }),
  language: Type.String({ minLength: 1, maxLength: 64 }),
  audienceLabel: Type.Optional(NullableString),
  artworkUrl: Type.Optional(NullableString),
},{additionalProperties:false});
const EpisodeBody = Type.Object({
  seasonNumber: Type.Integer({ minimum: 1, maximum: 1000 }),
  episodeNumber: Type.Integer({ minimum: 1, maximum: 100000 }),
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.String({ maxLength: 4000 }),
  durationSeconds: Type.Integer({ minimum: 1, maximum: 86400 }),
  audioUrl: Type.String({ minLength: 8, maxLength: 2048 }),
  artworkUrl: Type.Optional(NullableString),
},{additionalProperties:false});

function sendError(error: unknown, reply: any) {
  if (error instanceof StoryRadioError) {
    reply.code(error.statusCode);
    return { error: { code: error.code, message: error.code } };
  }
  throw error;
}

export function registerStoryRadioRoutes(
  app: FastifyInstance,
  service: StoryRadioService,
): void {
  const api = app.withTypeProvider<TypeBoxTypeProvider>();

  api.get("/story-radio/home", async (request, reply) => {
    try { return await service.home({ authorizationHeader: request.headers.authorization }); }
    catch (error) { return sendError(error, reply); }
  });

  api.get("/story-radio/series/:seriesId", {
    schema:{params:Type.Object({seriesId:SeriesId},{additionalProperties:false})},
  }, async (request, reply) => {
    try { return await service.series({
      authorizationHeader: request.headers.authorization,
      seriesId: request.params.seriesId,
    }); } catch (error) { return sendError(error, reply); }
  });

  api.put("/story-radio/progress", {
    schema:{body:Type.Object({
      seriesId:SeriesId, episodeId:EpisodeId,
      positionSeconds:Type.Integer({minimum:0,maximum:86400}),
      durationSeconds:Type.Integer({minimum:1,maximum:86400}),
      completed:Type.Boolean(),
    },{additionalProperties:false})},
  }, async (request, reply) => {
    try { return await service.saveProgress({
      authorizationHeader: request.headers.authorization,
      ...request.body,
    }); } catch (error) { return sendError(error, reply); }
  });

  api.get("/story-radio/episodes/:episodeId/reactions", {
    schema:{params:Type.Object({episodeId:EpisodeId},{additionalProperties:false})},
  }, async (request, reply) => {
    try { return await service.reactions({
      authorizationHeader: request.headers.authorization,
      episodeId: request.params.episodeId,
    }); } catch (error) { return sendError(error, reply); }
  });

  api.put("/story-radio/episodes/:episodeId/reaction", {
    schema:{
      params:Type.Object({episodeId:EpisodeId},{additionalProperties:false}),
      body:Type.Object({reaction:Type.Union([
        Type.Literal("like"),Type.Literal("love"),
        Type.Literal("funny"),Type.Literal("thoughtful"),
      ])},{additionalProperties:false}),
    },
  }, async (request, reply) => {
    try { return await service.react({
      authorizationHeader: request.headers.authorization,
      episodeId: request.params.episodeId,
      reaction: request.body.reaction,
    }); } catch (error) { return sendError(error, reply); }
  });

  api.get("/admin/story-radio", async (request, reply) => {
    try { return await service.adminList({ authorizationHeader: request.headers.authorization }); }
    catch (error) { return sendError(error, reply); }
  });

  api.post("/admin/story-radio/series", {
    schema:{body:SeriesBody},
  }, async (request, reply) => {
    try { return await service.adminCreateSeries({
      authorizationHeader: request.headers.authorization,
      ...request.body,
    }); } catch (error) { return sendError(error, reply); }
  });

  api.put("/admin/story-radio/series/:seriesId", {
    schema:{params:Type.Object({seriesId:SeriesId},{additionalProperties:false}),body:SeriesBody},
  }, async (request, reply) => {
    try { return await service.adminUpdateSeries({
      authorizationHeader: request.headers.authorization,
      seriesId:request.params.seriesId,
      ...request.body,
    }); } catch (error) { return sendError(error, reply); }
  });

  api.post("/admin/story-radio/series/:seriesId/publication", {
    schema:{
      params:Type.Object({seriesId:SeriesId},{additionalProperties:false}),
      body:Type.Object({published:Type.Boolean()},{additionalProperties:false}),
    },
  }, async (request, reply) => {
    try { return await service.adminSetSeriesPublication({
      authorizationHeader: request.headers.authorization,
      seriesId:request.params.seriesId,
      published:request.body.published,
    }); } catch (error) { return sendError(error, reply); }
  });

  api.post("/admin/story-radio/series/:seriesId/episodes", {
    schema:{params:Type.Object({seriesId:SeriesId},{additionalProperties:false}),body:EpisodeBody},
  }, async (request, reply) => {
    try { return await service.adminCreateEpisode({
      authorizationHeader: request.headers.authorization,
      seriesId:request.params.seriesId,
      ...request.body,
    }); } catch (error) { return sendError(error, reply); }
  });

  api.put("/admin/story-radio/episodes/:episodeId", {
    schema:{params:Type.Object({episodeId:EpisodeId},{additionalProperties:false}),body:EpisodeBody},
  }, async (request, reply) => {
    try { return await service.adminUpdateEpisode({
      authorizationHeader: request.headers.authorization,
      episodeId:request.params.episodeId,
      ...request.body,
    }); } catch (error) { return sendError(error, reply); }
  });

  api.post("/admin/story-radio/episodes/:episodeId/publication", {
    schema:{
      params:Type.Object({episodeId:EpisodeId},{additionalProperties:false}),
      body:Type.Object({published:Type.Boolean()},{additionalProperties:false}),
    },
  }, async (request, reply) => {
    try { return await service.adminSetEpisodePublication({
      authorizationHeader: request.headers.authorization,
      episodeId:request.params.episodeId,
      published:request.body.published,
    }); } catch (error) { return sendError(error, reply); }
  });
}
