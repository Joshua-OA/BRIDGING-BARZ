import { BarCodeScanner } from "expo-barcode-scanner";
import { CameraView, useCameraPermissions } from "expo-camera";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
	Alert,
	Dimensions,
	Platform,
	StyleSheet,
	TouchableOpacity,
	View,
} from "react-native";

import { ThemedText } from "@/components/ThemedText";

// Same secureStore helper as in auth.tsx
const secureStore = {
	async setItemAsync(key: string, value: string) {
		try {
			if (Platform.OS === "web") {
				localStorage.setItem(key, value);
				return;
			}
			return await SecureStore.setItemAsync(key, value);
		} catch (error) {
			console.warn("Storage error:", error);
			(global as any)[key] = value;
		}
	},
	async getItemAsync(key: string) {
		try {
			if (Platform.OS === "web") {
				return localStorage.getItem(key);
			}
			return await SecureStore.getItemAsync(key);
		} catch (error) {
			console.warn("Storage error:", error);
			return (global as any)[key];
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
			console.warn("Storage error:", error);
			delete (global as any)[key];
		}
	},
};

const API_BASE_URL =
	Constants.expoConfig?.extra?.apiUrl || "https://api.example.com";

export default function QRScannerScreen() {
	const [permission, requestPermission] = useCameraPermissions();
	const [scanned, setScanned] = useState(false);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!permission) {
			requestPermission();
		}
	}, [permission, requestPermission]);

	const handleAuthentication = async (campusId: string) => {
		try {
			setLoading(true);
			console.log(`Using campus ID: ${campusId}`);

			// Retrieve stored credentials
			const email = await secureStore.getItemAsync("temp_email");
			const password = await secureStore.getItemAsync("temp_password");
			const name = await secureStore.getItemAsync("temp_name");

			if (!email || !password) {
				Alert.alert("Error", "Authentication information is missing");
				router.replace("/auth");
				return;
			}

			// Complete authentication with backend
			const response = await fetch(`${API_BASE_URL}/auth/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email,
					password,
					name: name || undefined,
					campusId,
				}),
			});

			// Clear temporary stored credentials
			await secureStore.deleteItemAsync("temp_email");
			await secureStore.deleteItemAsync("temp_password");
			if (name) {
				await secureStore.deleteItemAsync("temp_name");
			}

			if (response.ok) {
				const data = await response.json();

				// Store JWT token for future authenticated requests
				if (data.token) {
					await secureStore.setItemAsync("authToken", data.token);
					console.log("JWT token stored successfully");
				}

				// Navigate to main app
				router.replace("/(tabs)");
			} else {
				const errorData = await response.json().catch(() => ({}));
				Alert.alert(
					"Authentication Failed",
					errorData.message || "Please try again"
				);
				router.replace("/auth");
			}
		} catch (error) {
			console.error("Error during QR authentication:", error);
			Alert.alert(
				"Connection Error",
				"Could not connect to authentication service"
			);
			router.replace("/auth");
		} finally {
			setLoading(false);
		}
	};

	const handleBarCodeScanned = async ({
		type,
		data,
	}: {
		type: string;
		data: string;
	}) => {
		if (scanned) return;
		setScanned(true);
		console.log(`Scanned QR code of type ${type} with data: ${data}`);

		let finalUrl = data;
		try {
			const email = await secureStore.getItemAsync("temp_email");
			if (email) {
				console.log("Retrieved email to prefill:", email);
				const encodedEmail = encodeURIComponent(email);
				if (finalUrl.includes("?")) {
					finalUrl = `${finalUrl}&email=${encodedEmail}`;
				} else {
					finalUrl = `${finalUrl}?email=${encodedEmail}`;
				}
			} else {
				console.log("No temporary email found in store to prefill.");
			}
		} catch (error) {
			console.error("Error retrieving email for prefill:", error);
		}

		console.log("Final URL for WebView/iframe:", finalUrl);
		router.push({ pathname: "/webViewScreen", params: { url: finalUrl } });
	};

	const handleCancel = () => {
		router.back();
	};

	if (!permission) {
		return (
			<View style={styles.container}>
				<LinearGradient
					colors={["#000000", "#200040", "#400060"]}
					style={styles.background}
				/>
				<ThemedText style={styles.text}>
					Requesting camera permission...
				</ThemedText>
			</View>
		);
	}

	if (!permission.granted) {
		return (
			<View style={styles.container}>
				<LinearGradient
					colors={["#000000", "#200040", "#400060"]}
					style={styles.background}
				/>
				<ThemedText style={styles.text}>
					Camera access is required to scan QR codes. Please grant permission in
					settings.
				</ThemedText>
				<TouchableOpacity style={styles.button} onPress={requestPermission}>
					<ThemedText style={styles.buttonText}>Grant Permission</ThemedText>
				</TouchableOpacity>
				<TouchableOpacity style={styles.button} onPress={handleCancel}>
					<ThemedText style={styles.buttonText}>Go Back</ThemedText>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<LinearGradient
				colors={["#000000", "#200040", "#400060"]}
				style={styles.background}
			/>
			<CameraView
				style={styles.camera}
				onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
				barcodeScannerSettings={{
					barcodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
				}}>
				<View style={styles.overlay}>
					<View style={styles.header}>
						<ThemedText style={styles.headerText}>
							Campus Verification
						</ThemedText>
					</View>
					<View style={styles.scanFrameContainer}>
						<View style={styles.scanFrame} />
						{!scanned && (
							<ThemedText style={styles.instructions}>
								Align QR code within the frame
							</ThemedText>
						)}
					</View>
					<View style={styles.bottomControls}>
						{/* The "Scan Again" button in the bottomControls might still be useful 
						    if the user wants to cancel going to the WebView and scan a different QR.
						    Or, it could be removed if navigation is immediate.
						 */}
						{/* {scanned && !loading && (
							<TouchableOpacity
								style={styles.button}
								onPress={() => {
									setScanned(false); // Allow re-scanning
								}}>
								<ThemedText style={styles.buttonText}>Scan Again</ThemedText>
							</TouchableOpacity>
						)} */}
						<TouchableOpacity
							style={[styles.cancelButton, loading && styles.disabledButton]}
							onPress={handleCancel}
							disabled={loading}>
							<ThemedText style={styles.cancelButtonText}>
								Cancel Scan
							</ThemedText>
						</TouchableOpacity>
					</View>
				</View>
			</CameraView>
			{loading && (
				<View style={styles.loadingOverlay}>
					<ThemedText style={styles.loadingText}>Authenticating...</ThemedText>
				</View>
			)}
		</View>
	);
}

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000",
		justifyContent: "center",
		alignItems: "center",
	},
	camera: {
		...StyleSheet.absoluteFillObject,
	},
	background: {
		position: "absolute",
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
	},
	overlay: {
		flex: 1,
		justifyContent: "space-between",
		alignItems: "center",
		paddingTop: Constants.statusBarHeight + 20,
		paddingBottom: 40,
	},
	header: {
		alignItems: "center",
		marginTop: 20,
	},
	headerText: {
		fontSize: 24,
		fontWeight: "bold",
		color: "white",
		textAlign: "center",
	},
	scanFrameContainer: {
		alignItems: "center",
		justifyContent: "center",
	},
	scanFrame: {
		width: width * 0.7,
		height: width * 0.7,
		borderWidth: 2,
		borderColor: "#0A84FF",
		borderRadius: 20,
		backgroundColor: "transparent",
	},
	instructions: {
		fontSize: 16,
		color: "white",
		textAlign: "center",
		marginTop: 20,
		textShadowColor: "rgba(0, 0, 0, 0.75)",
		textShadowOffset: { width: -1, height: 1 },
		textShadowRadius: 10,
	},
	text: {
		fontSize: 18,
		color: "white",
		textAlign: "center",
		marginBottom: 20,
		paddingHorizontal: 20,
	},
	button: {
		backgroundColor: "#0A84FF",
		paddingVertical: 15,
		paddingHorizontal: 35,
		borderRadius: 30,
		marginBottom: 15,
		minWidth: 150,
		alignItems: "center",
	},
	buttonText: {
		color: "white",
		fontSize: 16,
		fontWeight: "bold",
		textAlign: "center",
	},
	cancelButton: {
		paddingVertical: 15,
		paddingHorizontal: 35,
		borderRadius: 30,
		backgroundColor: "#888888",
		minWidth: 150,
		alignItems: "center",
	},
	cancelButtonText: {
		color: "white",
		fontSize: 16,
		textAlign: "center",
		fontWeight: "bold",
	},
	disabledButton: {
		opacity: 0.5,
	},
	loadingOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0,0,0,0.7)",
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		fontSize: 18,
		color: "white",
		textShadowColor: "rgba(0, 0, 0, 0.75)",
		textShadowOffset: { width: -1, height: 1 },
		textShadowRadius: 10,
	},
	bottomControls: {
		flexDirection: "row",
		justifyContent: "space-around",
		alignItems: "center",
		width: "100%",
		paddingHorizontal: 20,
		marginBottom: 20,
	},
});
