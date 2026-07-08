// Ambient declarations for CSS side-effect imports (e.g. `global.css`) and
// CSS-module imports on the web target. NativeWind/react-native-css handle the
// runtime; these only satisfy the type-checker.
declare module "*.css";

declare module "*.module.css" {
	const classes: { readonly [key: string]: string };
	export default classes;
}
