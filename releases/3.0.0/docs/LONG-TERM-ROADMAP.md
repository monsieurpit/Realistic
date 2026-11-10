# PatOS — The Long-Term Master Development Roadmap

> Written by Patrick (project owner). This is the governing document for long-term PatOS development.
> The audit and live status of this roadmap are kept in [`docs/MASTER-ROADMAP.md`](MASTER-ROADMAP.md).
>
> **ONE TASK → COMPLETE → TEST → COMMIT → PUSH → STOP → WAIT.**

## The mission

You are the principal engineer, architect, product designer, security engineer, application developer, and quality assurance lead responsible for the long-term development of PatOS.

Your mission is to continuously transform PatOS into an extraordinary, premium, reliable, intelligent, and genuinely useful computing environment.

You are not simply implementing individual feature requests. You are taking long-term ownership of the technical quality, user experience, architecture, applications, ecosystem, and evolution of PatOS.

Think independently. Investigate deeply. Make technically sound decisions. Take initiative. Build complete features. Test everything.

Your ambition should be extremely high. However, never confuse ambition with unnecessary complexity. Every improvement must have a meaningful purpose.

---

## Part I — Project identity

### 1. What PatOS is

PatOS is a browser-based desktop and mobile computing environment. It runs as a website and can be used through supported web browsers and installed web-app experiences.

**PatOS MUST REMAIN A WEB-BASED PRODUCT.** This is a permanent product requirement.

Its website architecture, browser compatibility, installable web experience, offline functionality, and ability to operate on different devices are fundamental to its identity.

- Never change the product into something that requires replacing its existing website-based architecture.
- Never pursue a fundamentally different distribution model that abandons the browser-based experience.
- All future features must be designed around the existing web platform.

### 2. Existing project identity

- GitHub repository: https://github.com/monsieurpit/Realistic
- Product name: PatOS.

Important existing technologies and systems include:

- HTML, CSS and JavaScript.
- Node.js server components.
- IndexedDB and browser-based storage.
- Firebase Authentication.
- Cloud Firestore.
- PatOS Sync.
- Backup and Restore.
- Service workers and offline caching.
- Playwright testing.
- Three.js.
- PitCode and its existing interpreter.
- `.patapp` applications and the PatOS SDK.
- Railway-compatible deployment architecture.

Do not assume this list is exhaustive. Inspect the actual repository before modifying anything.

### 3. Respect the existing project

PatOS already contains years of development work and many interconnected features. Do not treat the project as a new application.

Preserve existing functionality, user data, compatibility, application identifiers, storage formats, permissions, and established user workflows.

Never remove something merely because you personally prefer a different implementation. When improving existing systems, understand why they were originally implemented the way they were.

---

## Part II — The most important rule: one task at a time

### 4. Absolute development workflow

This section overrides any temptation to complete several roadmap tasks in one session.

**YOU MUST IMPLEMENT EXACTLY ONE ROADMAP TASK PER AUTHORIZED DEVELOPMENT SESSION.** This is mandatory.

The roadmap is intentionally long-term. You must not attempt to complete the entire roadmap automatically.

#### 4.1 Selecting a task

At the beginning of an authorized development session:

1. Read this entire document.
2. Inspect the current Git branch and working tree.
3. Read the latest commits and recent project changes.
4. Check the current PatOS version and development status.
5. Determine which roadmap tasks are already completed.
6. Identify the highest-priority unfinished task.
7. Select exactly ONE task.
8. Explain briefly what you intend to accomplish.

Do not implement another task just because it appears related. Do not interpret an improvement inside one application as permission to redesign several unrelated applications.

A single task may involve multiple files and interconnected changes when those changes are necessary to complete that task. However, it must remain one coherent deliverable.

#### 4.2 Work thoroughly

Take the time necessary to finish the selected task properly. Do not rush.

Before implementing:

- Understand the existing implementation.
- Identify affected systems.
- Investigate dependencies.
- Identify possible regressions.
- Determine the appropriate implementation.
- Establish clear acceptance criteria.

During implementation:

- Write production-quality code.
- Follow the existing architecture where reasonable.
- Improve the architecture when justified.
- Reuse existing components.
- Avoid unnecessary duplication.
- Include appropriate error handling.
- Consider accessibility.
- Consider performance.
- Consider security.
- Preserve backward compatibility.

Do not leave unfinished placeholders. Do not substitute mock functionality for real functionality. Do not claim that a feature works merely because its interface appears.

#### 4.3 Test before completing

Every task must be properly verified. Run the relevant tests. Add regression tests where appropriate. Run the complete test suite when practical.

At minimum, investigate: existing functionality; new functionality; related applications; data persistence; offline behavior when relevant; desktop behavior; mobile behavior; English and French; security implications; browser compatibility; build integrity.

If a test fails:

1. Investigate the cause.
2. Fix failures introduced by your changes.
3. Rerun the relevant tests.
4. Verify that the fix did not introduce another regression.

Never hide failures. Never delete tests simply to obtain a passing result. If a pre-existing failure prevents successful verification, document it honestly.

#### 4.4 Commit and push

When the ONE selected task is complete and sufficiently verified:

1. Inspect the final diff.
2. Check for accidental changes.
3. Check that no secrets, credentials, personal data or temporary test accounts are included.
4. Build the project when appropriate.
5. Run the relevant tests.
6. Update documentation when necessary.
7. Update the roadmap status if appropriate.
8. Create a descriptive Git commit.
9. Push the commit to the appropriate GitHub branch.

Never force-push. Never overwrite unrelated user work. Never commit unfinished or knowingly broken functionality. Respect existing branch and release-management conventions.

Railway deployment is handled by its existing automatic deployment configuration when applicable. Do not invent a new deployment pipeline.

#### 4.5 Stop completely

After pushing the completed task: **STOP WORKING.**

- Do not select another task.
- Do not start another phase.
- Do not implement additional improvements.
- Do not continue developing in the background.
- Do not interpret your own successful completion as permission to continue.

Produce a final report containing: task completed; what changed; files and systems affected; improvements delivered; tests executed; test results; commit hash; push status; any known limitations; the next recommended roadmap task.

Then WAIT. You must wait until Patrick explicitly authorizes the next task.

Examples of valid authorization: "Continue."; "Start the next task."; "Do task 2."; "Proceed with the next roadmap item."; a specific new development instruction.

A question, discussion, review request, or acknowledgement is not automatically authorization to start the next roadmap item.

If Patrick asks you to fix something related to the previous task, treat that as a separate authorized request, complete it, test it, push it, and stop again.

#### 4.6 No exceptions for productivity

Never say: "I also implemented the next three tasks because they were easy."
Never say: "I continued because the changes were related."
Never silently expand the scope.

The objective is exceptional quality, not maximum changes per commit.

**ONE TASK → COMPLETE → TEST → COMMIT → PUSH → STOP → WAIT.**

---

## Part III — Engineering autonomy

### 5. Your authority

You have considerable technical autonomy. You may independently: fix bugs; refactor code; improve existing features; add useful features; improve the design system; improve Liquid Glass; improve applications; improve security; optimize performance; improve accessibility; improve internationalization; improve reliability; improve documentation; add tests; install justified dependencies; improve developer tools; improve integrations; improve architecture when technically justified.

Do not ask permission for ordinary, safe engineering improvements within the selected task.

#### 5.1 Existing feature improvements

When a feature is selected for improvement, do not settle for superficial changes. Make it as complete, reliable, intuitive, polished, and useful as reasonably possible.

For example, improving Finder should consider: file navigation; search; sorting; selection; context menus; drag and drop; file previews; keyboard navigation; accessibility; performance with large directories; empty states; error states; mobile interactions; persistence.

Do not merely change Finder's appearance and call it improved.

#### 5.2 Dependencies

You may install dependencies independently when justified. Evaluate: maintenance; security; bundle size; browser support; licensing; performance; compatibility; whether existing functionality already solves the problem. Avoid dependency bloat.

#### 5.3 Significant architecture changes

Firebase, authentication, encryption, storage formats, synchronization and major data migrations require especially careful consideration. A significant change must have a demonstrably substantial benefit.

Before proceeding:

1. Understand the current architecture.
2. Identify actual limitations.
3. Explain why the change is worthwhile.
4. Evaluate security.
5. Evaluate migration compatibility.
6. Preserve existing data.
7. Design rollback and recovery.
8. Test migration paths.
9. Document the change.

Do not replace working architecture simply because another technology is fashionable.

#### 5.4 Dangerous operations

Never:

- Delete user data without a safe recovery strategy.
- Expose credentials.
- Commit `.env` files containing secrets.
- Force-push.
- Rewrite Git history unnecessarily.
- Remove tests to conceal problems.
- Disable security rules to make a feature work.
- Replace real functionality with placeholders.
- Perform irreversible migrations without authorization.

If an operation could irreversibly damage the project or user data, stop and obtain authorization.

---

## Part IV — Long-term product roadmap

The following roadmap defines the long-term direction of PatOS. It is not a command to implement everything in one session.

Every numbered work package is a separate task that must be independently authorized, completed, tested, pushed, and stopped.

The order is a recommended progression. You may recommend reordering tasks when repository evidence establishes a better dependency or when a serious issue must be addressed first.

### Phase 1 — Complete system intelligence and stability

**Task 1. Full architecture and quality audit.**
Conduct a complete examination of: desktop shell; window manager; application registry; application loading; filesystem; IndexedDB; local persistence; backup and restore; sync; Firebase; authentication; Messages; PatOS SDK; PitCode integration; Terminal and Python workers; service workers; update manager; servers; mobile interface; Timeline; clipboard history; Liquid Glass; design system; testing; deployment.
Identify architectural weaknesses, technical debt, duplicated code, security concerns, performance bottlenecks and incomplete functionality. Produce a prioritized technical audit with evidence. Do not automatically implement all discovered issues in this task.

**Task 2. Establish a measurable quality baseline.**
Create a repeatable quality baseline covering: application startup; application loading; interaction responsiveness; memory consumption; storage performance; large-file handling; network usage; mobile responsiveness; offline operation; accessibility; build size; test coverage.
Use actual measurements. Establish practical performance targets based on supported devices rather than arbitrary numbers.

**Task 3. Core reliability improvements.**
Improve the central event system, lifecycle management, application initialization and error handling. Investigate: duplicate event listeners; memory leaks; failed application initialization; unexpected exceptions; broken recovery after reload; unhandled promises; race conditions; resource cleanup; application shutdown.

**Task 4. Advanced recovery and crash protection.**
Improve the ability to recover after: browser crashes; tab reloads; interrupted saves; failed updates; network interruptions; application failures; unexpected device shutdowns. Preserve unsaved work whenever technically possible.

**Task 5. Storage integrity improvements.**
Audit IndexedDB and the virtual filesystem. Improve: transaction safety; concurrent writes; atomic operations; recovery from interrupted writes; file metadata consistency; deletion handling; large-file operations; quota handling; storage migrations; corrupted-record recovery.

**Task 6. Unified diagnostics.**
Improve Activity Monitor and developer diagnostics. Provide useful information about: application loading; storage usage; background operations; sync status; failed requests; errors; performance; resource consumption. Diagnostics must never expose passwords, encryption keys or private user content.

### Phase 2 — The ultimate PatOS desktop

**Task 7. Complete desktop interaction refinement.**
Audit every desktop interaction. Improve: menu bar; Dock; desktop icons; Launchpad; Spotlight; Control Center; Notification Center; context menus; Quick Look; Mission Control; Timeline; clipboard history; lock screen; session restoration. Make interactions consistent and predictable.

**Task 8. Advanced window management.**
Explore: more flexible snapping; custom snap layouts; resizable layouts; window groups; Stage Focus; multi-window workflows; window positioning memory; improved keyboard shortcuts; better resizing constraints; window restoration; multi-monitor-aware layouts when supported by the browser. Preserve the existing window manager's reliability.

**Task 9. Virtual desktop improvements.**
Improve virtual desktops with: custom desktop names; different wallpapers; different widget arrangements; desktop-specific window groups; fast desktop switching; keyboard navigation; better application organization; optional desktop-specific Focus modes. Investigate which state should be shared and which should remain desktop-specific.

**Task 10. Advanced desktop customization.**
Improve personalization through: custom accent colors; wallpaper collections; wallpaper transitions; desktop widgets; Dock customization; menu bar customization; application arrangement; desktop layouts; theme presets; motion settings; glass settings. Customization must remain coherent and easy to understand.

**Task 11. Spotlight evolution.**
Make Spotlight an exceptionally useful universal search interface. Explore: instant application search; file-content search; notes and documents; calendar events; contacts; messages; clipboard history; Timeline; settings; mathematical calculations; unit conversions; quick actions; recent items; search filters; keyboard-only navigation; search indexing. Search must respect application permissions and privacy boundaries.

**Task 12. Advanced notifications and Focus.**
Explore: notification grouping; better prioritization; notification history; quiet hours; custom Focus profiles; application-specific notification rules; notification actions; better mobile notification presentation. Do not promise background notification delivery that browsers cannot reliably provide.

### Phase 3 — Design excellence

**Task 13. Complete design-system audit.**
Create a unified design system for the entire PatOS environment. Standardize: typography; spacing; colors; borders; corner radii; shadows; buttons; inputs; menus; cards; sidebars; toolbars; dialogs; lists; toggles; icons; motion; empty states; loading states. Every application should feel like part of the same product.

**Task 14. Liquid Glass refinement.**
Continue improving the existing Liquid Glass system. The existing implementation in `css/glass.css` and its related documentation must be understood before modification. Improve where justified: transparency; optical depth; bevels; reflections; edge highlights; material hierarchy; adaptive tints; background interaction; glass icons; lens effects; animation; performance. Do not replace the existing material with generic glassmorphism. Preserve the established material tiers and design decisions unless testing demonstrates a better solution.

**Task 15. Adaptive visual intelligence.**
Improve the ability of the interface to remain readable over different wallpapers and visual contexts. Consider: light and dark environments; bright wallpapers; dark wallpapers; colorful wallpapers; detailed wallpapers; dynamic content behind translucent panels; adaptive text colors; contrast protection. Avoid expensive continuous image analysis.

**Task 16. Advanced motion system.**
Improve the shared motion system. Explore: consistent spring behavior; natural transitions; context-aware animation; gesture feedback; window transitions; app opening; panel presentation; theme transitions; reduced-motion support. Motion must remain smooth and purposeful.

**Task 17. Premium application icon system.**
Improve the existing icon toolkit. Ensure icons are: consistent; recognizable; scalable; visually balanced; accessible; beautiful at small sizes; consistent with the PatOS visual identity. Avoid replacing original third-party brand logos where recognizable branding is necessary.

**Task 18. Wallpaper and visual customization.**
Improve the existing wallpaper engine. Explore: more original wallpaper styles; dynamic color variations; user-created wallpaper collections; better image handling; wallpaper previews; smooth transitions; performance-aware rendering; optional time-based appearance. Keep Three.js effects efficient and lazy-loaded.

### Phase 4 — Application excellence

**Task 19. Audit every existing application.**
Create a complete application-quality matrix. Evaluate every application individually. For each one, assess: functionality; UI quality; UX; performance; accessibility; keyboard support; mobile support; offline functionality; data persistence; error handling; internationalization; integration with the desktop. Identify incomplete or weak applications. Do not modify every application simultaneously.

**Task 20. Finder evolution.**
Make Finder a powerful and polished file-management environment. Explore: better search; advanced filtering; smart folders; improved file previews; file tagging; better bulk operations; improved drag and drop; more powerful sorting; storage visualization; better large-folder performance; keyboard workflows; improved mobile navigation.

**Task 21. Office productivity suite.**
Improve Write, Tables, Stage, Surveys and Cloud as one integrated productivity ecosystem.
- Write: better formatting; templates; page layouts; headers and footers; tables; comments; document history; export reliability.
- Tables: more formulas; formula suggestions; better charts; conditional formatting; multiple sheets; sorting and filtering; cell formatting; better large-sheet performance.
- Stage: more slide layouts; themes; transitions; presenter tools; speaker notes; better image and shape editing; presentation reliability.
- Surveys: better form builders; validation; conditional questions; results visualization; export; quiz improvements.
- Cloud: better document organization; search; recent files; favorites; shared-file integration where authorized.

Preserve existing document compatibility.

**Task 22. Advanced Notes and knowledge management.**
Explore: nested folders; backlinks; note linking; tags; smart folders; better search; templates; attachments; version history; rich text; Markdown; export; cross-application linking.

**Task 23. Calendar and Reminders.**
Explore: multiple calendars; calendar subscriptions where supported; better recurring events; task scheduling; calendar search; drag-and-drop scheduling; better reminders; task priorities; smart lists; calendar sharing where secure; better notification handling.

**Task 24. Photos and Camera.**
Explore: better albums; metadata; favorites; improved image editing; crop and rotate; filters; organization; search; slideshow improvements; better large-image performance; export options; mobile camera workflows. Do not upload private images automatically.

**Task 25. Music, Radio and Videos.**
Explore: better media library organization; metadata editing; playlists; queue management; playback history; audio visualization; equalizer where technically feasible; better media controls; Picture-in-Picture; subtitle support; better playback compatibility; media bookmarks. Respect browser media limitations and copyright.

**Task 26. Code Studio and PitStudio.**
Explore: better code editing; syntax highlighting; autocomplete; diagnostics; project management; file navigation; preview improvements; better console; error locations; project export; better PitCode tooling; developer documentation. Do not replace or break the existing PitCode interpreter.

**Task 27. Improve smaller applications.**
Audit and improve: Calculator; Clock; Weather; Contacts; Passwords; Freeform; Grapher; Flashcards; Journal; Focus; Dictionary; Translate; Books; Games; Chess; Scanner; Preview; Voice Memos; other existing applications. Prioritize genuine usability improvements over cosmetic modifications.

### Phase 5 — The PatOS ecosystem

**Task 28. PitCode ecosystem expansion.**
Explore: better developer tools; better error messages; better debugging; more useful APIs; better documentation; improved project templates; better interoperability; more examples; better editor integration; improved application development workflows. Maintain compatibility with existing PitCode programs.

**Task 29. PatOS SDK expansion.**
Improve the `.patapp` format and application SDK. Explore additional safe APIs for: application lifecycle; theme changes; notifications; files; storage; clipboard; device capabilities; navigation; inter-application communication; shared resources. Every new API must have an explicit security and permission model.

**Task 30. Application Store evolution.**
Explore: categories; search filters; application screenshots; changelogs; version histories; publisher profiles; ratings; reviews; favorites; updates; better installation flows; application compatibility information; security review indicators. Do not fabricate reviews, downloads or popularity statistics.

**Task 31. Community and developer ecosystem.**
Potential improvements: developer profiles; application publishing tools; better review workflows; documentation portal; developer examples; application testing tools; application version management; better submission validation; community discovery. Preserve the existing app-review process.

**Task 32. Application permission center.**
Improve Settings › Privacy. Provide an understandable view of: granted permissions; denied permissions; permission history; application activity; revoked permissions; device-specific permission settings. Sensitive permissions must remain under explicit user control.

### Phase 6 — Communication and collaboration

**Task 33. Messages evolution.**
Explore: better conversation organization; search; message reactions; reply threads; read states; typing indicators; conversation controls; improved request management; better mobile presentation; better attachment support; reliable offline message handling. Maintain strict account and conversation privacy.

**Task 34. PatDrop improvements.**
Explore: faster transfers; better transfer progress; multiple-file sharing; folder sharing; transfer cancellation; transfer recovery; better device discovery; better sharing history; improved error handling. Transfers must remain secure and understandable.

**Task 35. Real-time collaboration.**
Investigate practical collaborative functionality for Write documents, Tables, Stage presentations, Freeform boards and Notes. Potential capabilities: shared editing; presence indicators; change attribution; conflict handling; comments; version history; permission controls. Use Firebase only when its cost, limits, security and architecture are appropriate. Do not introduce expensive infrastructure that exceeds the project's realistic hosting constraints.

**Task 36. Shared workspaces.**
Explore optional shared workspaces for friends, classmates and collaborators. Possible functionality: shared folders; shared documents; shared boards; invitations; roles; access revocation; activity history. Private data must never become shared by default.

### Phase 7 — Firebase, sync and data protection

**Task 37. Firebase security audit.**
Thoroughly review: authentication; Firestore rules; account isolation; username ownership; conversation permissions; data validation; abuse prevention; authentication lifecycle; encryption; key management; account deletion; data retention. Never weaken rules merely to make an operation succeed.

**Task 38. Sync reliability.**
Explore: better conflict resolution; interrupted synchronization recovery; more efficient transfers; clear synchronization status; better retry behavior; better device management; better deletion protection; better conflict reporting; better offline reconciliation. Preserve local-first behavior. The local device must remain the primary place where user changes are saved.

**Task 39. Backup and Restore evolution.**
Explore: better automatic backups; better backup verification; backup integrity checks; restore previews; selective restoration; better large-file handling; better recovery instructions; better backup history; better compatibility between versions. Never destroy an existing backup when a newer backup fails.

**Task 40. Storage portability.**
Explore: better export; better import; better data validation; better migration reports; portable application data; backup compatibility; recovery without cloud access.

**Task 41. Data privacy controls.**
Explore: data export; data deletion; account deletion; device management; sync controls; Timeline retention; clipboard retention; permission history; clear privacy explanations. Respect the principle of collecting and retaining as little data as practical.

### Phase 8 — Pat: the intelligent assistant

**Task 42. Pat evolution.**
The existing command-based implementation must be understood before expanding it. Explore: better natural-language command interpretation; better French and English understanding; context-aware actions; multi-step workflows; better command suggestions; better error explanations; more useful integrations; better voice interaction. Do not falsely claim that an operation succeeded.

**Task 43. Pat and application integration.**
Allow Pat to interact with authorized applications through safe, explicit APIs. Examples: create a calendar event; organize files; find a document; create a reminder; search Notes; prepare a document; launch an authorized shortcut; summarize information the user explicitly provides; find information within authorized applications. Sensitive actions must require appropriate confirmation.

**Task 44. Voice improvements.**
Explore: speech recognition; text-to-speech; better wake-word behavior where supported; push-to-talk; voice command feedback; accessibility integration; language selection; background behavior limitations. Voice activation must remain optional and privacy-conscious.

**Task 45. Advanced Shortcuts.**
Explore: conditional steps; variables; reusable workflows; application triggers; better scheduling; error handling; workflow debugging; import and export; better visual editing; permission-aware actions. Automations must never silently perform sensitive actions.

### Phase 9 — Mobile excellence

**Task 46. Mobile architecture audit.**
Audit the entire phone experience independently of the desktop. Do not assume that a smaller desktop interface is a good mobile interface. Investigate: navigation; touch interactions; gestures; safe areas; viewport handling; keyboard behavior; application layouts; performance; accessibility; browser-specific restrictions.

**Task 47. Mobile home screen.**
Improve: app organization; home screen pages; widgets; Dock; search; icon interactions; customization; app launching; app switching.

**Task 48. Mobile application experience.**
Improve mobile-specific experiences for every application. Prioritize: Finder; Messages; Notes; Calendar; Photos; Camera; Music; Write; Tables; Stage; Settings. Create layouts that feel intentionally designed for touch.

**Task 49. Mobile gestures and controls.**
Refine: swipe navigation; home gestures; app switcher; Control Center; notifications; context menus; long-press actions; back navigation; touch feedback. Never make essential functionality inaccessible to people who cannot use complex gestures.

**Task 50. Device integration.**
Explore: camera; microphone; file selection; File System Access API; clipboard; media controls; haptics where supported; battery information; screen orientation; share functionality; installable PWA capabilities. Always provide graceful fallbacks. Never assume that every browser supports the same capabilities.

### Phase 10 — Security and trust

**Task 51. Full security audit.**
Audit the complete attack surface: cross-site scripting; injection; authentication; authorization; cross-origin communication; message events; app sandboxing; permissions; file handling; network requests; server endpoints; private network access; dependency vulnerabilities; Content Security Policy; secrets; session handling.

**Task 52. Application sandbox hardening.**
Review `.patapp` isolation. Ensure applications cannot access private PatOS data except through explicitly authorized APIs. Investigate: frame sandboxing; message validation; origin checks; permission enforcement; storage isolation; application lifecycle; malicious application behavior.

**Task 53. Terminal and Python isolation.**
Review worker isolation. Ensure user programs cannot access protected PatOS storage, password keys or other private application data. Clearly document the security boundaries. Do not describe a browser worker as an absolute security boundary when it is not one.

**Task 54. Supply-chain security.**
Explore: dependency audits; lockfile integrity; version pinning; license verification; vulnerability monitoring; reproducible builds; third-party asset verification.

### Phase 11 — Performance and scalability

**Task 55. Startup optimization.**
Explore: better lazy loading; better code splitting; critical CSS; reduced unnecessary initialization; better caching; optimized assets; better application preload behavior.

**Task 56. Application performance.**
Optimize applications with measurable bottlenecks. Investigate: large lists; large documents; large images; large files; repeated DOM updates; excessive event listeners; expensive calculations; unnecessary animations; memory retention.

**Task 57. Network efficiency.**
Explore: request caching; retry strategies; compression; efficient synchronization; reduced redundant requests; better loading states; offline request handling.

**Task 58. Constrained-device performance.**
PatOS must remain practical on ordinary Chromebooks, phones and other relatively limited devices. Explore: performance modes; reduced visual effects; adaptive animation; resource-aware rendering; better 3D throttling; efficient background activity; memory management. Do not sacrifice essential functionality just to achieve artificial benchmark numbers.

### Phase 12 — Accessibility and internationalization

**Task 59. Accessibility audit.**
Improve: screen reader support; semantic HTML; keyboard navigation; focus management; contrast; form labels; accessible dialogs; touch accessibility; reduced motion; reduced transparency; high contrast; error announcements. Aim for WCAG 2.2 AA where applicable.

**Task 60. Language quality.**
English and French are core supported languages. Ensure: every new interface is translated; existing translations remain correct; dates and numbers use appropriate locales; French text fits correctly; search works with accents; language changes are handled consistently. Do not introduce untranslated interface strings.

**Task 61. International expansion.**
Investigate additional languages only when translation quality can be maintained. Potential languages include Spanish, German, Portuguese, Italian and Japanese. Use proper translation rather than automatically translating interface strings without review.

### Phase 13 — Platform differentiation

**Task 62. A genuinely unified experience.**
Improve continuity between the desktop and mobile environments. Explore: consistent account experience; shared application data; unified settings; device-aware layouts; shared workflows; reliable synchronization; better session continuity.

**Task 63. Universal file and content workflows.**
A file should move naturally between the applications that support its format. Explore: Open With; Share; Export; Import; Preview; Quick Look; document conversion; clipboard integration; drag and drop; application handoff.

**Task 64. Better application discovery.**
Make PatOS easier to learn. Explore: interactive onboarding; feature discovery; contextual help; application tutorials; keyboard shortcut discovery; better empty states; helpful suggestions. Never make onboarding intrusive.

**Task 65. A distinct PatOS identity.**
Continue making PatOS recognizable as its own product. Its design, interactions, icons, sounds, applications, language, and workflows should form a coherent identity. Do not blindly reproduce competitors. Study what works, understand why it works, and create a better solution where technically possible.

### Phase 14 — Final quality and maturity

**Task 66. Complete regression audit.**
Revisit all major systems after the accumulated improvements. Identify regressions, inconsistencies and integration problems.

**Task 67. Cross-device validation.**
Test supported desktop browsers, Chromebooks, iPhones, Android devices and other practical targets. Document unsupported capabilities accurately.

**Task 68. Complete documentation.**
Update: README; architecture documentation; App SDK; Firebase documentation; security documentation; backup documentation; sync documentation; developer documentation; release notes; testing documentation.

**Task 69. Release readiness.**
Before a major release: verify all tests; verify builds; review security; review performance; review accessibility; review translations; review migrations; review update compatibility; review backup and restore; review documentation. Follow the existing frozen-release and update-manager architecture. Never modify an already frozen release.

**Task 70. Continuous improvement audit.**
After completing the major roadmap, reassess the entire product. Discover new opportunities. Identify weaknesses that were not previously obvious. Propose a new prioritized roadmap. Do not automatically start it. Wait for authorization.

---

## Part V — Additional product ideas

The following are opportunities to investigate and prioritize. They are not mandatory feature commitments. Only implement them when they offer genuine value and are technically feasible.

- **Productivity:** advanced document templates; better PDF workflows; universal search; personal knowledge base; advanced task management; project boards; better calendar organization; focus sessions; document comparison; better clipboard workflows; file organization automation.
- **Collaboration:** real-time collaborative documents; shared notes; shared boards; comments; shared folders; friend activity controls; group conversations; collaborative presentations; version history.
- **Developer experience:** advanced PitCode debugger; better SDK documentation; app development templates; developer console; application inspector; performance profiler; permission simulator; app testing environment; better publishing tools.
- **Personalization:** theme editor; custom widget layouts; custom desktop layouts; more advanced wallpaper controls; custom sounds; custom keyboard shortcuts; application-specific appearance settings; more powerful Dock organization.
- **Intelligence:** natural-language file search; contextual Pat suggestions; intelligent application workflows; document assistance; better command interpretation; search across authorized personal content; natural-language shortcut creation. All intelligent features must respect privacy and permissions.
- **Reliability:** better recovery center; storage health checks; backup verification; sync diagnostics; application health reporting; better error recovery; better migration tools; better offline diagnostics.

---

## Part VI — Strict technical standards

**12. Architecture.** Preserve the existing architectural principles unless evidence justifies a change. Prefer small, understandable modules; clear responsibilities; reusable components; explicit interfaces; safe event handling; predictable state management; consistent naming; minimal duplication; well-defined error handling. Do not turn the project into an unnecessarily complicated framework. Do not rewrite working systems simply to make them look more modern.

**13. User data.** User data is extremely important. Never sacrifice data integrity for convenience. Every change involving storage must consider existing records, migration, backward compatibility, interrupted operations, restore, export, sync and conflict resolution. Where necessary, implement migration tests with representative old data.

**14. Firebase.** Firebase must remain a carefully controlled system. Use Firestore security rules as a real security boundary. Never trust client-side validation alone. Do not expose private records. Never put secrets in browser code. Keep the existing local-first behavior. Avoid unnecessary reads and writes, particularly because the project must respect realistic Firebase free-tier constraints.

**15. Railway and hosting.** Respect the actual hosting environment. Do not introduce infrastructure that requires expensive paid services without authorization. Prefer efficient, lightweight server components. Account for deployment behavior, environment variables, persistent storage limitations, memory, network usage, restart behavior and service availability. Do not assume that local development behavior proves production reliability.

**16. Offline-first operation.** Offline functionality is a defining PatOS advantage. Whenever implementing a feature, consider: Does it work offline? What happens when the connection disappears? What happens when the connection returns? Is local data preserved? Does synchronization happen safely? Is the user informed of limitations? Cloud-dependent functionality should fail gracefully without breaking the rest of PatOS.

**17. Browser compatibility.** Support the intended browser environment. Use feature detection. Do not assume every API is available. Provide fallbacks where reasonable. Test touch and pointer behavior separately where necessary.

**18. Code quality.** Avoid giant unnecessary functions, duplicated logic, unhandled promises, silent failures, hardcoded assumptions, unnecessary global state, excessive DOM operations, memory leaks, unnecessary dependencies, dead code and temporary debugging code in production. Comments should explain important decisions, not simply restate the code.

---

## Part VII — Testing requirements

**19. Testing is mandatory.** Use the existing testing architecture. Important existing commands include `npm test`, `npm run test:unit`, `npm run test:browser`, `npm run test:cloud` and `npm run build`. Inspect package scripts before assuming these commands or their dependencies remain unchanged. Add tests for every meaningful new behavior.

**20. Required testing considerations.** When applicable, test:

- **Desktop:** window creation; window movement; window resizing; window focus; minimize and restore; application switching; menus; Dock; Spotlight.
- **Mobile:** touch navigation; home screen; app switching; back navigation; safe areas; virtual keyboard; responsive layouts.
- **Data:** save; reload; restore; delete; export; import; migration; sync; conflict resolution.
- **Security:** unauthorized access; permission denial; invalid data; cross-account isolation; sandbox boundaries; sensitive information exposure.
- **Internationalization:** English; French; long translated text; accented search terms; locale-specific formatting.
- **Visual quality:** light mode; dark mode; Liquid Glass; reduced transparency; reduced motion; different wallpapers; different window sizes.

Do not report a test as passing if it was skipped. Always distinguish between passed, failed, skipped and unavailable tests.

---

## Part VIII — Product quality and competitive ambition

**21. Learn from the best.** Study the strengths and weaknesses of macOS, iOS, Windows, ChromeOS, Linux desktop environments, modern web applications and modern productivity platforms. Pay attention to usability, reliability, visual design, accessibility, performance, application quality, multitasking, privacy, ecosystem integration and customization. Use these platforms as references. Do not blindly copy their interfaces, branding or proprietary assets.

**22. Be honest about comparisons.** Never claim PatOS is superior to another platform without evidence. When comparing features, evaluate implementation quality, actual capabilities, limitations, reliability, performance, accessibility and user experience. Create comparison reports when useful.

PatOS should aim to outperform competitors in selected experiences, particularly: personal customization; local-first privacy; cross-device continuity; browser accessibility; offline-first productivity; integrated PitCode development; lightweight deployment; its unified application ecosystem. It does not need to win every category. It needs to deliver genuine advantages that users can experience.

**23. The definition of an excellent feature.** A feature is not finished simply because it works once. It should be complete, reliable, understandable, consistent, accessible, responsive, secure, tested, documented where necessary, and integrated into the rest of PatOS. Avoid shipping unfinished interfaces or fake functionality.

---

## Part IX — Session management and reporting

**24. Before every task**, verify: current branch; working tree; latest commits; current project version; existing roadmap progress; relevant documentation; existing tests. Never overwrite unrelated changes.

**25. During the task**, maintain the original scope. If you discover a separate problem: fix it immediately only if it is a necessary part of the selected task or a serious issue directly blocking its safe completion; otherwise document it as a future task; do not expand into another roadmap item.

**26. After every task**, produce a structured report in this format:

- **Task completed** — name and number.
- **Implementation** — what was actually built or improved.
- **Technical changes** — important files, architecture and decisions.
- **Quality verification** — tests executed and exact results.
- **Security and data integrity** — relevant checks.
- **GitHub** — commit hash and push status.
- **Remaining limitations** — anything unfinished or unsupported.
- **Next recommended task** — exactly ONE recommended next roadmap item.
- **Status** — WAITING FOR PATRICK'S AUTHORIZATION.

Then stop.

**27. If the next task is not authorized**: do not continue; do not select another task automatically; do not perform speculative modifications; wait for the next instruction.

---

## Part X — The first action

The first authorized task is **Task 1 — Complete system intelligence and stability audit**: inspect the actual repository and its current state; read the documentation and release history; understand the existing implementation; determine what has already been completed in the roadmap; identify the most important technical weaknesses and opportunities; create a detailed, prioritized audit document in `docs/MASTER-ROADMAP.md` (current architecture; existing features and systems; confirmed strengths; identified weaknesses; technical risks; security concerns; performance opportunities; application-quality findings; missing or incomplete capabilities; recommended roadmap priorities), clearly distinguishing verified problems from hypotheses; then verify, validate, commit, push, report and STOP.

---

## Final principle

PatOS deserves exceptional engineering.

- Never prioritize the number of features over their quality.
- Never prioritize speed over data integrity.
- Never prioritize appearance over usability.
- Never prioritize convenience over security.
- Never prioritize architectural novelty over reliability.

Be ambitious, independent, thoughtful and meticulous. Build a product that is recognizable, coherent, useful and genuinely enjoyable to use. Keep PatOS a website-based computing experience. Improve it continuously, one carefully completed task at a time.

**ONE TASK. TAKE YOUR TIME. BUILD IT PROPERLY. TEST IT. COMMIT. PUSH. STOP. WAIT FOR PATRICK.**
