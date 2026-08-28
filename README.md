# Telegram Mastermind

​Project Title: Universal Telegram Automation Controller (Bot & UserBot Hybrid)

​"Build a high-end React dashboard (Shadcn/Tailwind) to manage automated Telegram posting. The system must support two modes: 'Bot Mode' (via Webhook) and 'Account Mode' (via external Python/MTProto).

​1. Dual-Engine Configuration Page:

​Bot Settings: Fields for BOT_TOKEN and Webhook URL.

​Account Settings: Fields for API_ID, API_HASH, and STRING_SESSION.

​Status Toggle: A switch to select which 'Engine' is currently active for posting.

​2. Access Control System (The /access logic):

​Admin Table: Add/Remove Main Admin Telegram IDs.

​Permission Mapping: A searchable table showing: User_ID | Assigned_Channels | Expiry_Time.

​This table must update when the /access command is used in the authorized Group Chat.

​3. Advanced Scheduler (The /post logic):

​Task Queue: A UI component that tracks active /post everyX timeY jobs.

​Fields: Message Content (Text/Media), Interval (Minutes), Remaining Cycles, and 'Delete After' timer.

​Logic: When a command is received, create a new row in a post_queue table.

​4. The 'Auto-Delete' Monitor:

​Create a view that lists all posts made by the system that are pending deletion.

​Include a countdown timer for each post based on the 'Delete Duration' setting.

​5. Group Chat Integration:

​A setting to define 'Authorized Group IDs'. The system must ignore commands from any other chat.

​Log all incoming commands in a 'Live Feed' style component."

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://auto-tele-pilot.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9bf88330-d149-4b29-9ff2-95a06e4ad48d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
