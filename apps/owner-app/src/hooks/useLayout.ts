import { useWindowDimensions } from "react-native";
import { MaxContentWidth } from "../constants/theme";

export function useLayout() {
	const { width, height } = useWindowDimensions();
	const isLandscape = width > height;
	const isTablet = width >= 768;
	const contentWidth = Math.min(width, MaxContentWidth);
	return { width, height, isLandscape, isTablet, contentWidth };
}
