# Responsive Layout Guide

Both Expo apps (`apps/mobile-app`, `apps/owner-app`) support phones, tablets, and landscape orientation.

## Breakpoints

| Name         | Condition         | Notes                              |
| ------------ | ----------------- | ---------------------------------- |
| `isTablet`   | width ≥ 768 pt    | iPad, large Android tablets        |
| `isLandscape`| width > height    | Any device in landscape orientation |

## `useLayout` hook

Always use this instead of `Dimensions.get()` or raw `useWindowDimensions()`:

```ts
import { useLayout } from "../hooks/useLayout";

function MyComponent() {
  const { width, height, isLandscape, isTablet, contentWidth } = useLayout();
  // ...
}
```

**Never call `Dimensions.get()` at module level** — the value is captured at import time and won't update on rotation. Only call it inside components via `useWindowDimensions()` or `useLayout()`.

## `ScreenContainer` wrapper

Wrap each screen's root view in `ScreenContainer`. On tablet it centers the content at up to 800 pt wide; on phone it's a transparent pass-through.

```tsx
import { ScreenContainer } from "../components/ScreenContainer";

export default function BookingsScreen() {
  return (
    <ScreenContainer>
      <ScrollView>
        {/* ... */}
      </ScrollView>
    </ScreenContainer>
  );
}
```

Pass `style` for additional root-level styles (`backgroundColor`, `paddingTop`, etc.):

```tsx
<ScreenContainer style={{ backgroundColor: Colors.paper }}>
```

## Tab navigation

- **Phone portrait / landscape**: bottom tab bar. In landscape the vertical padding is reduced.
- **Tablet**: left sidebar (width 220 pt) replaces the bottom bar. Rendered in `(tabs)/_layout.tsx`.

The `TabBar` component returns `null` when `isTablet` is true; the `Sidebar` component is conditionally rendered as a flex-row sibling to `Tabs`.

## Adapting screen layouts

For screens that benefit from different layouts on wide screens:

```tsx
const { isTablet, isLandscape, contentWidth } = useLayout();

// Two-column on tablet, single column on phone
<View style={{ flexDirection: isTablet ? "row" : "column" }}>
  <MainContent />
  {isTablet && <DetailPanel />}
</View>
```

## `contentWidth`

`contentWidth = Math.min(width, 800)` — safe for use as a width cap on any element that should not stretch past `MaxContentWidth` (defined in `src/constants/theme.ts`).
