# AF07: professional Masana avatars in Chats and Calls

Companion to merged #722 and the 26 source-controlled, app-bundled fictional AI portrait assets.

The same `MasanaPortraitAvatar` now renders the selected professional's illustration on the chat header, forward-to-Masana selection sheet, and native live voice call sheet. It takes the already-authorized `AgentDirectoryEntry`, never invents a contact, and falls back to initials for admin-managed names. No additional image fetch on startup.

This is UI source integration; actual voice media, signed Android, and live Gateway/Worker/DB remain release gates. No changes to chat history, call billing or token authorization.
