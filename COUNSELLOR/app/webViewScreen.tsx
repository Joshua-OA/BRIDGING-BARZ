import { ThemedText } from "@/components/ThemedText";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	StyleSheet,
	TouchableOpacity,
	View,
} from "react-native";
import { WebView } from "react-native-webview";

const secureStore = {
	async setItemAsync(key: string, value: string) {
		try {
			if (Platform.OS === "web") {
				localStorage.setItem(key, value);
				return;
			}
			return await SecureStore.setItemAsync(key, value);
		} catch (error) {
			console.warn("SecureStore setItemAsync error:", error);
			if (Platform.OS === "web") (globalThis as any)[key] = value;
		}
	},
	async getItemAsync(key: string) {
		try {
			if (Platform.OS === "web") {
				return localStorage.getItem(key);
			}
			return await SecureStore.getItemAsync(key);
		} catch (error) {
			console.warn("SecureStore getItemAsync error:", error);
			if (Platform.OS === "web") return (globalThis as any)[key];
			return null;
		}
	},
	async deleteItemAsync(key: string) {
		try {
			if (Platform.OS === "web") {
				localStorage.removeItem(key);
				return;
			}
			return await SecureStore.deleteItemAsync(key);
		} catch (error) {
			console.warn("SecureStore deleteItemAsync error:", error);
			if (Platform.OS === "web") delete (globalThis as any)[key];
		}
	},
};

const API_BASE_URL =
	Constants.expoConfig?.extra?.apiUrl || "https://api.example.com";

export default function WebViewScreen() {
	const { url } = useLocalSearchParams<{ url?: string }>();
	const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		if (Platform.OS === "web" && url) {
			const handleMessage = async (event: MessageEvent) => {
				console.log("-------------------------------------------");
				console.log("IFRAME MESSAGE EVENT (WEB):");
				console.log("Origin:", event.origin);
				console.log("Raw Data Type:", typeof event.data);
				console.log("Raw Data:", event.data);
				console.log("-------------------------------------------");

				// SECURITY TODO: Add origin check for production
				// if (event.origin !== "EXPECTED_ORIGIN_OF_MINT_PAGE_HTTPS") {
				//   console.warn(`Message from untrusted origin '${event.origin}' blocked.`);
				//   return;
				// }

				try {
					// The mint page HTML sends stringified JSON
					const messageData = JSON.parse(event.data as string); // Assuming event.data is a string
					console.log("Parsed messageData (WEB):", messageData);

					if (
						messageData.success &&
						messageData.access_token &&
						messageData.wallet_address
					) {
						setLoadingMessage("Verification complete. Finalizing setup...");
						await secureStore.setItemAsync(
							"authToken",
							messageData.access_token
						);
						await secureStore.setItemAsync(
							"walletAddress",
							messageData.wallet_address
						);
						console.log("Token and Wallet Address stored successfully (WEB).");
						await secureStore.deleteItemAsync("temp_email");
						router.replace("/(tabs)");
					} else if (messageData.success === false) {
						console.error(
							"Error from mint page (WEB):",
							messageData.message,
							messageData.errorDetails || messageData.errorType
						);
						Alert.alert(
							"Verification Error",
							messageData.message || "An error occurred during verification."
						);
						setLoadingMessage(null); // Clear loading message
						// Optionally, router.back() or offer a retry mechanism
					} else {
						console.warn(
							"Received message from iframe with unexpected structure (WEB):",
							messageData
						);
					}
				} catch (e) {
					console.error(
						"Failed to parse or process message from iframe (WEB):",
						e,
						"Raw data was:",
						event.data
					);
					// Alert.alert("Error", "Received an invalid message from the page."); // Optional user feedback
					setLoadingMessage(null);
				}
			};

			window.addEventListener("message", handleMessage);
			return () => window.removeEventListener("message", handleMessage);
		}
	}, [url]);

	if (!url) {
		return (
			<View style={[styles.container, styles.centerContent]}>
				<ThemedText>Error: No URL provided.</ThemedText>
				<TouchableOpacity style={styles.button} onPress={() => router.back()}>
					<ThemedText style={styles.buttonText}>Go Back</ThemedText>
				</TouchableOpacity>
			</View>
		);
	}

	if (loadingMessage) {
		return (
			<View style={[styles.container, styles.centerContent]}>
				<ActivityIndicator color="#0A84FF" size="large" />
				<ThemedText style={{ marginTop: 10 }}>{loadingMessage}</ThemedText>
			</View>
		);
	}

	if (Platform.OS === "web") {
		return (
			<View style={styles.container}>
				<iframe
					ref={iframeRef}
					src={url}
					style={styles.iframe}
					title="Embedded Web Content"
					sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
				/>
				<TouchableOpacity
					style={styles.closeButton}
					onPress={() => router.back()}>
					<ThemedText style={styles.buttonText}>Close</ThemedText>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<WebView
				source={{ uri: url }}
				style={styles.webView}
				startInLoadingState={true}
				renderLoading={() => (
					<ActivityIndicator
						color="#0A84FF"
						size="large"
						style={styles.loadingIndicator}
					/>
				)}
				onError={(syntheticEvent) => {
					const { nativeEvent } = syntheticEvent;
					console.warn("WebView error: ", nativeEvent);
					Alert.alert(
						"Error",
						`Failed to load page: ${
							nativeEvent.description || nativeEvent.code
						}`
					);
					router.back();
				}}
				onMessage={async (event) => {
					console.log("-------------------------------------------");
					console.log("WEBVIEW MESSAGE EVENT (NATIVE):");
					console.log("Raw Data Type:", typeof event.nativeEvent.data);
					console.log("Raw Data (Native):", event.nativeEvent.data);
					console.log("-------------------------------------------");

					try {
						const messageData = JSON.parse(event.nativeEvent.data);
						console.log("Parsed messageData (NATIVE):", messageData);

						if (
							messageData.success &&
							messageData.access_token &&
							messageData.wallet_address
						) {
							setLoadingMessage("Verification complete. Finalizing setup...");
							await secureStore.setItemAsync(
								"authToken",
								messageData.access_token
							);
							await secureStore.setItemAsync(
								"walletAddress",
								messageData.wallet_address
							);
							console.log(
								"Token and Wallet Address stored successfully (NATIVE)."
							);
							await secureStore.deleteItemAsync("temp_email");
							router.replace("/(tabs)");
						} else if (messageData.success === false) {
							console.error(
								"Error from mint page (NATIVE):",
								messageData.message,
								messageData.errorDetails || messageData.errorType
							);
							Alert.alert(
								"Verification Error",
								messageData.message || "An error occurred during verification."
							);
							setLoadingMessage(null); // Clear loading message
						} else {
							console.warn(
								"Received message from WebView with unexpected structure (NATIVE):",
								messageData
							);
						}
					} catch (e) {
						console.error(
							"Failed to parse or process message from WebView (NATIVE):",
							e,
							"Raw data was:",
							event.nativeEvent.data
						);
						// Alert.alert("Error", "Received an invalid message from the page."); // Optional user feedback
						setLoadingMessage(null);
					}
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingTop: Platform.OS === "web" ? 0 : Constants.statusBarHeight,
		backgroundColor: "#fff",
	},
	centerContent: {
		justifyContent: "center",
		alignItems: "center",
	},
	webView: {
		flex: 1,
	},
	iframe: {
		flex: 1,
		width: "100%",
		height: "100%",
		borderWidth: 0,
	},
	loadingIndicator: {
		position: "absolute",
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		alignItems: "center",
		justifyContent: "center",
	},
	closeButton: {
		position: "absolute",
		top: Constants.statusBarHeight || 10,
		right: 10,
		backgroundColor: "rgba(0,0,0,0.5)",
		padding: 10,
		borderRadius: 15,
	},
	button: {
		backgroundColor: "#0A84FF",
		paddingVertical: 12,
		paddingHorizontal: 30,
		borderRadius: 25,
		alignItems: "center",
		marginTop: 20,
	},
	buttonText: {
		color: "white",
		fontSize: 16,
		fontWeight: "bold",
	},
});
