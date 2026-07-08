// @repo/ui-native — shared mobile component library for the Expo apps.
//
// Mirrors how @repo/ui serves the web apps: ships TypeScript source (no build
// step), consumes the shared design tokens from @repo/tokens, and owns the
// single `cn` class-merge util. Each component is the canonical superset of the
// two apps' previously-drifted copies (#63); both apps adopt these and delete
// their per-app versions in #64.

export { cn } from "./cn";
export { Avatar, type AvatarProps } from "./components/Avatar";
export type { AvatarSize } from "./components/Avatar.styles";
export {
	Badge,
	type BadgeProps,
	type BadgeSize,
	type BadgeVariant,
	type BookingStatus,
	StatusPill,
	type StatusPillProps,
} from "./components/Badge";
export { Button, type ButtonProps } from "./components/Button";
export type {
	ButtonSize,
	ButtonVariant,
} from "./components/Button.styles";
export { Card, type CardProps } from "./components/Card";
export type {
	CardPadding,
	CardRounded,
	CardShadow,
} from "./components/Card.styles";
export {
	type DeleteAccountAuthMethods,
	type DeleteAccountProof,
	DeleteAccountVerificationModal,
} from "./components/DeleteAccountVerificationModal";
export { Divider, type DividerProps } from "./components/Divider";
export type {
	DividerDirection,
	DividerStrength,
} from "./components/Divider.styles";
export { Eyebrow, type EyebrowProps } from "./components/Eyebrow";
export { Icon, type IconName, type IconProps } from "./components/Icon";
export type { IconSize } from "./components/Icon.styles";
export {
	SectionTitle,
	type SectionTitleProps,
} from "./components/SectionTitle";
export { Stars, type StarsProps } from "./components/Stars";
export type { StarSize } from "./components/Stars.styles";
export { Surface, type SurfaceProps } from "./components/Surface";

export {
	Switch,
	type SwitchProps,
	ToggleSwitch,
} from "./components/Switch";
export type { SwitchSize } from "./components/Switch.styles";
