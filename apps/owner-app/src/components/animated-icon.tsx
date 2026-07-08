import { Image } from "expo-image";
import { useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, Keyframe } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const DURATION = 600;

const logoKeyframe = new Keyframe({
	0: { transform: [{ scale: 1.3 }], opacity: 0 },
	40: { transform: [{ scale: 1.3 }], opacity: 0, easing: Easing.elastic(0.7) },
	100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.elastic(0.7) },
});

const glowKeyframe = new Keyframe({
	0: { transform: [{ rotateZ: "0deg" }] },
	100: { transform: [{ rotateZ: "7200deg" }] },
});

export function AnimatedSplashOverlay() {
	const { height } = useWindowDimensions();
	const [visible, setVisible] = useState(true);
	const scaleFactor = height / 90;

	const splashKeyframeRef = useRef<InstanceType<typeof Keyframe> | null>(null);
	if (!splashKeyframeRef.current) {
		splashKeyframeRef.current = new Keyframe({
			0: { transform: [{ scale: scaleFactor }], opacity: 1 },
			20: { opacity: 1 },
			70: { opacity: 0, easing: Easing.elastic(0.7) },
			100: {
				opacity: 0,
				transform: [{ scale: 1 }],
				easing: Easing.elastic(0.7),
			},
		});
	}

	if (!visible) return null;

	return (
		<Animated.View
			entering={splashKeyframeRef.current
				.duration(DURATION)
				.withCallback((finished: boolean) => {
					"worklet";
					if (finished) {
						scheduleOnRN(setVisible, false);
					}
				})}
			style={styles.backgroundSolidColor}
		/>
	);
}

export function AnimatedIcon() {
	const { height } = useWindowDimensions();
	const scaleFactor = height / 90;

	const bgKeyframeRef = useRef<InstanceType<typeof Keyframe> | null>(null);
	if (!bgKeyframeRef.current) {
		bgKeyframeRef.current = new Keyframe({
			0: { transform: [{ scale: scaleFactor }] },
			100: { transform: [{ scale: 1 }], easing: Easing.elastic(0.7) },
		});
	}

	return (
		<View style={styles.iconContainer}>
			<Animated.View
				entering={glowKeyframe.duration(60 * 1000 * 4)}
				style={styles.glow}
			>
				<Image
					style={styles.glow}
					source={require("@/assets/images/logo-glow.png")}
				/>
			</Animated.View>

			<Animated.View
				entering={bgKeyframeRef.current.duration(DURATION)}
				style={styles.background}
			/>
			<Animated.View
				style={styles.imageContainer}
				entering={logoKeyframe.duration(DURATION)}
			>
				<Image
					style={styles.image}
					source={require("@/assets/images/expo-logo.png")}
				/>
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	imageContainer: {
		justifyContent: "center",
		alignItems: "center",
	},
	glow: {
		width: 201,
		height: 201,
		position: "absolute",
	},
	iconContainer: {
		justifyContent: "center",
		alignItems: "center",
		width: 128,
		height: 128,
		zIndex: 100,
	},
	image: {
		position: "absolute",
		width: 76,
		height: 71,
	},
	background: {
		borderRadius: 40,
		experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
		width: 128,
		height: 128,
		position: "absolute",
	},
	backgroundSolidColor: {
		...StyleSheet.absoluteFill,
		backgroundColor: "#208AEF",
		zIndex: 1000,
	},
});
