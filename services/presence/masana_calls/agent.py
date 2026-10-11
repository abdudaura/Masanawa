"""Dedicated qualified Masana voice-call agent. Not imported by retired Talk agent."""
import logging
import os
from livekit import rtc
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli, room_io
from livekit.agents.llm import ChatContext, ChatMessage, StopResponse
from livekit.plugins import google

from contract import MasanaCallDispatch, qualified_gemini_voice
from runtime import MasanaCallRuntime, MasanaVoiceContext

log = logging.getLogger("masanawa-calls")
server = AgentServer()

class QualifiedMasanaAgent(Agent):
    def __init__(self, dispatch: MasanaCallDispatch, store: MasanaCallRuntime, initial: MasanaVoiceContext):
        instructions = (
            f"You are {initial.display_name}, an AI professional working as {initial.profession}. "
            "This is a private voice call with one authenticated Masanawa fan. "
            "Speak naturally in the fan's language; be concise. "
            "Do not claim real-world professional licensing or impersonate a real person. "
            "Do not make payments, punishments, or other consequential changes in the call. "
            f"Approved character story: {initial.biography}"
        )
        super().__init__(instructions=instructions)
        self.dispatch = dispatch
        self.store = store

    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        try:
            runtime = await self.store.read(self.dispatch)
        except Exception:
            raise StopResponse() from None
        if not runtime.active:
            raise StopResponse()

@server.rtc_session(agent_name=os.getenv("MASANAWA_CALLS_AGENT_NAME", "masanawa-calls"))
async def entrypoint(ctx: JobContext) -> None:
    dispatch = MasanaCallDispatch.parse(ctx.job.metadata)
    dispatch.assert_room(ctx.room.name)
    database_url = os.getenv("MASANAWA_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("database_unconfigured")
    store = await MasanaCallRuntime.connect(database_url)
    try:
        initial = await store.read(dispatch)
        if not initial.active:
            raise PermissionError("expired_or_ineligible")
        key = os.getenv("MASANAWA_GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not key:
            raise RuntimeError("gemini_unconfigured")
        voice = qualified_gemini_voice(initial.voice_id, os.getenv("MASANAWA_CALLS_GEMINI_VOICE_PROFILES_JSON", "{}"))
        model = os.getenv("MASANAWA_CALLS_GEMINI_LIVE_MODEL", "gemini-3.1-flash-live-preview")
        await ctx.connect()
        session = AgentSession(llm=google.beta.realtime.RealtimeModel(
            model=model, voice=voice, api_key=key
        ))
        await session.start(
            room=ctx.room, agent=QualifiedMasanaAgent(dispatch, store, initial),
            room_options=room_io.RoomOptions(close_on_disconnect=True, video_input=False)
        )
        ctx.log_context_fields = {"call_id": dispatch.call_id, "character_id": dispatch.character_id}
    finally:
        ctx.add_shutdown_callback(store.close)

if __name__ == "__main__":
    cli.run_app(server)
