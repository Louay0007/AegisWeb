# Accessibility Manual Checklist

Pass criteria for launch:

- `pnpm qa:a11y` has zero critical or serious axe violations.
- Every interactive control is reachable and operable by keyboard.
- Focus order follows the visual order on desktop and mobile.
- Visible focus indicators are present for links, buttons, inputs, menus, and dialogs.
- Dialogs trap focus and restore focus to the trigger when closed.
- Forms expose labels, validation messages, and error summaries to assistive technology.
- Text remains usable at 200% zoom without horizontal page scrolling.
- Pages work with reduced motion enabled.
- Status/error/loading messages are exposed through appropriate live regions or roles.
- Color is never the only indicator of state, risk, or required action.
