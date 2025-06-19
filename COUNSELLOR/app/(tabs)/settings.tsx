import { ThemedText } from "@/components/ThemedText";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useNavigation } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Image,
	Platform,
	StatusBar,
	StyleSheet,
	TouchableOpacity,
	View,
} from "react-native";

// Re-use or import your secureStore helper
const secureStore = {
	async getItemAsync(key: string) {
		try {
			if (Platform.OS === "web") return localStorage.getItem(key);
			return await SecureStore.getItemAsync(key);
		} catch (e) {
			console.warn("secureStore.getItemAsync Error", e);
			return null;
		}
	},
	async deleteItemAsync(key: string) {
		try {
			if (Platform.OS === "web") return localStorage.removeItem(key);
			return await SecureStore.deleteItemAsync(key);
		} catch (e) {
			console.warn("secureStore.deleteItemAsync Error", e);
		}
	},
	// Add setItemAsync if needed here, or import from a shared utility
};

export default function SettingsScreen() {
	const [walletAddress, setWalletAddress] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const navigation = useNavigation();

	// Dummy NFT data - replace with actual data fetching if possible
	const [nftData, setNftData] = useState({
		name: "Campus Verification NFT",
		imageUrl: null, // Replace with a real image URL or use a placeholder icon
		estimatedWorth: "$150.75", // Placeholder
		collectionName: "Bridging Bars Collection",
	});

	useEffect(() => {
		navigation.setOptions({
			headerStyle: {
				backgroundColor: "#100020",
			},
			headerTintColor: "#FFFFFF",
			headerTitleStyle: {
				color: "#FFFFFF",
			},
		});
	}, [navigation]);

	useEffect(() => {
		const fetchWalletData = async () => {
			setIsLoading(true);
			try {
				const address = await secureStore.getItemAsync("walletAddress");
				setWalletAddress(address);
				// Here you might fetch NFT details based on the walletAddress if you have an API
			} catch (error) {
				console.error("Failed to fetch wallet address:", error);
				Alert.alert("Error", "Could not load wallet address.");
			} finally {
				setIsLoading(false);
			}
		};
		fetchWalletData();
	}, []);

	const handleLogout = async () => {
		Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Logout",
				style: "destructive",
				onPress: async () => {
					try {
						await secureStore.deleteItemAsync("authToken");
						await secureStore.deleteItemAsync("walletAddress");
						await secureStore.deleteItemAsync("temp_email");
						router.replace("/auth");
					} catch (error) {
						console.error("Logout error:", error);
						Alert.alert("Error", "Failed to logout.");
					}
				},
			},
		]);
	};

	if (isLoading) {
		return (
			<View style={[styles.container, styles.centered]}>
				<LinearGradient
					colors={["#000000", "#200040", "#400060"]}
					style={StyleSheet.absoluteFill}
				/>
				<ActivityIndicator size="large" color="#0A84FF" />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar
				barStyle={Platform.OS === "ios" ? "light-content" : "light-content"}
			/>
			<LinearGradient
				colors={["#000000", "#200040", "#400060"]}
				style={StyleSheet.absoluteFill}
			/>

			<View style={styles.sectionContainer}>
				<ThemedText style={styles.sectionTitle}>My Wallet</ThemedText>
				<View style={styles.walletCard}>
					<View style={styles.walletHeader}>
						<ThemedText style={styles.walletLabel}>Wallet Address:</ThemedText>
						<ThemedText style={styles.walletAddress} selectable>
							{walletAddress || "Not available"}
						</ThemedText>
					</View>

					<ThemedText style={styles.nftSectionTitle}>My NFT</ThemedText>
					<View style={styles.nftItem}>
						{nftData.imageUrl ? (
							<Image
								source={{ uri: nftData.imageUrl }}
								style={styles.nftImage}
							/>
						) : (
							<View style={styles.nftImagePlaceholder}>
								<Ionicons
									name="image-outline"
									size={60}
									color="rgba(255,255,255,0.3)"
								/>
							</View>
						)}
						<View style={styles.nftDetails}>
							<ThemedText style={styles.nftName}>{nftData.name}</ThemedText>
							<ThemedText style={styles.nftCollection}>
								{nftData.collectionName}
							</ThemedText>
							<ThemedText style={styles.nftWorthLabel}>
								Estimated Worth:
							</ThemedText>
							<ThemedText style={styles.nftWorthValue}>
								{nftData.estimatedWorth}
							</ThemedText>
						</View>
					</View>
				</View>
			</View>

			{/* Add other settings sections here */}

			<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
				<ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
	},
	centered: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 20,
		color: "#FFFFFF",
		paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
	},
	sectionContainer: {
		marginBottom: 30,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: "600",
		color: "rgba(255,255,255,0.85)",
		marginBottom: 15,
	},
	walletCard: {
		backgroundColor: "rgba(40,20,60,0.7)",
		borderRadius: 12,
		padding: 20,
	},
	walletHeader: {
		marginBottom: 20,
	},
	walletLabel: {
		fontSize: 14,
		color: "rgba(255,255,255,0.6)",
		marginBottom: 4,
	},
	walletAddress: {
		fontSize: 15,
		color: "rgba(255,255,255,0.85)",
		fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
	},
	nftSectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "rgba(255,255,255,0.8)",
		marginTop: 10,
		marginBottom: 15,
		borderTopWidth: 1,
		borderTopColor: "rgba(255,255,255,0.1)",
		paddingTop: 15,
	},
	nftItem: {
		flexDirection: "row",
		alignItems: "center",
	},
	nftImage: {
		width: 80,
		height: 80,
		borderRadius: 8,
		marginRight: 15,
		backgroundColor: "rgba(255,255,255,0.1)",
	},
	nftImagePlaceholder: {
		width: 80,
		height: 80,
		borderRadius: 8,
		marginRight: 15,
		backgroundColor: "rgba(0,0,0,0.3)",
		justifyContent: "center",
		alignItems: "center",
	},
	nftDetails: {
		flex: 1,
	},
	nftName: {
		fontSize: 17,
		fontWeight: "bold",
		color: "white",
	},
	nftCollection: {
		fontSize: 13,
		color: "rgba(255,255,255,0.6)",
		marginBottom: 8,
	},
	nftWorthLabel: {
		fontSize: 13,
		color: "rgba(255,255,255,0.5)",
		marginTop: 5,
	},
	nftWorthValue: {
		fontSize: 16,
		fontWeight: "600",
		color: "#4CAF50",
	},
	logoutButton: {
		marginTop: "auto",
		backgroundColor: "#D32F2F",
		paddingVertical: 15,
		borderRadius: 25,
		alignItems: "center",
		marginBottom: 10,
	},
	logoutButtonText: {
		color: "white",
		fontSize: 16,
		fontWeight: "bold",
	},
});
