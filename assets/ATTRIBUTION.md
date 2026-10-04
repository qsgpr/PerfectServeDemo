# Login branding reference

The PerfectServe logo is downloaded unmodified from its public website:
https://cdn.prod.website-files.com/6a7e9a49e5445d650964631e/6a936b56d674c548a8cc678e_aa15b4e62681235e44ec488b09867fc1_PerfectServe-dark.svg

Source page: https://www.perfectserve.com/solutions/clinical-communication-collaboration
Accessed October 3, 2026. The website's public plum, evergreen, linen, ink, and orchid colors informed the login layout. The logo remains PerfectServe's property; its inclusion does not imply affiliation or endorsement. The surrounding login composition and text are original. The app is an unofficial local presentation prototype. At the user’s request, this disclosure is kept in project documentation rather than the visible screens.

`src/components/logo.ts` embeds the same SVG markup for native and web rendering via react-native-svg. The SVG requires no external image request. Authentication uses Supabase when configured.
