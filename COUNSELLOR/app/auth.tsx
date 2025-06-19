import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StatusBar,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";

import { ThemedText } from "@/components/ThemedText";

// Access environment variables
const API_BASE_URL =
	Constants.expoConfig?.extra?.apiUrl || "https://api.example.com";

// Add this helper function at the top of your file after imports
const secureStore = {
	async setItemAsync(key: string, value: string) {
		try {
			if (Platform.OS === "web") {
				// Fallback for web
				localStorage.setItem(key, value);
				return;
			}
			return await SecureStore.setItemAsync(key, value);
		} catch (error) {
			console.warn("Storage error:", error);
			// Fallback to memory storage for development
			(global as any)[key] = value;
		}
	},
	async getItemAsync(key: string) {
		try {
			if (Platform.OS === "web") {
				// Fallback for web
				return localStorage.getItem(key);
			}
			return await SecureStore.getItemAsync(key);
		} catch (error) {
			console.warn("Storage error:", error);
			// Fallback to memory storage for development
			return (global as any)[key];
		}
	},
	async deleteItemAsync(key: string) {
		try {
			if (Platform.OS === "web") {
				// Fallback for web
				localStorage.removeItem(key);
				return;
			}
			return await SecureStore.deleteItemAsync(key);
		} catch (error) {
			console.warn("Storage error:", error);
			// Delete from memory storage
			delete (global as any)[key];
		}
	},
};

export default function AuthScreen() {
	const [isLogin, setIsLogin] = useState(false);
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleCredentialsSubmit = async () => {
		if (
			(!isLogin && (!name || !email || !password)) ||
			(isLogin && (!email || !password))
		) {
			Alert.alert("Error", "Please fill in all required fields.");
			return;
		}

		setIsLoading(true);

		try {
			const endpoint = isLogin
				? `${API_BASE_URL}/counselor/login`
				: `${API_BASE_URL}/counselor/register`;
			const payload = isLogin ? { email, password } : { name, email, password };

			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			if (response.ok) {
				console.log(
					isLogin
						? "Initial login step successful (if applicable)"
						: "Registration successful"
				);

				await secureStore.setItemAsync("temp_email", email);
				if (!isLogin && name) {
				}

				router.push("/qr-scanner");
			} else {
				const errorData = await response
					.json()
					.catch(() => ({ message: "An error occurred." }));
				Alert.alert(
					isLogin ? "Login Failed" : "Registration Failed",
					errorData.message || "Please check your details and try again."
				);
			}
		} catch (error: any) {
			console.error(isLogin ? "Login error:" : "Registration error:", error);
			Alert.alert(
				"Error",
				error.message || "Could not connect to the server. Please try again."
			);
		} finally {
			setIsLoading(false);
		}
	};

	const toggleAuthMode = () => {
		setIsLogin(!isLogin);
		setEmail("");
		setName("");
		setPassword("");
	};

	return (
		<View style={styles.container}>
			<StatusBar barStyle="light-content" />
			<LinearGradient
				colors={["#000000", "#200040", "#400060"]}
				style={styles.background}
			/>

			<KeyboardAvoidingView
				style={styles.container}
				behavior={Platform.OS === "ios" ? "padding" : "height"}>
				<ScrollView contentContainerStyle={styles.scrollContent}>
					<View style={styles.header}>
						<ThemedText style={styles.brandText}>
							BRIDGING BARS |\|||\
						</ThemedText>
					</View>

					<View style={styles.contentContainer}>
						<ThemedText style={styles.title}>
							{isLogin ? "Sign in (Step 1)" : "Create Account"}
						</ThemedText>

						{!isLogin && (
							<ThemedText style={styles.subtitle}>
								Already have an account?{" "}
								<ThemedText style={styles.linkText} onPress={toggleAuthMode}>
									Sign in
								</ThemedText>
							</ThemedText>
						)}

						{isLogin && (
							<ThemedText style={styles.subtitle}>
								Don't have an account?{" "}
								<ThemedText style={styles.linkText} onPress={toggleAuthMode}>
									Create an account
								</ThemedText>
							</ThemedText>
						)}

						<View style={styles.inputContainer}>
							{!isLogin && (
								<TextInput
									style={styles.input}
									placeholder="Name"
									placeholderTextColor="rgba(255,255,255,0.5)"
									value={name}
									onChangeText={setName}
									autoCapitalize="words"
								/>
							)}
							<TextInput
								style={styles.input}
								placeholder="Email"
								placeholderTextColor="rgba(255,255,255,0.5)"
								value={email}
								onChangeText={setEmail}
								keyboardType="email-address"
								autoCapitalize="none"
							/>
							<TextInput
								style={styles.input}
								placeholder="Password"
								placeholderTextColor="rgba(255,255,255,0.5)"
								value={password}
								onChangeText={setPassword}
								secureTextEntry
							/>

							<TouchableOpacity
								style={[styles.button, isLoading && styles.disabledButton]}
								onPress={handleCredentialsSubmit}
								disabled={isLoading}>
								<ThemedText style={styles.buttonText}>
									{isLoading
										? "Processing..."
										: isLogin
										? "Continue"
										: "Create Account & Continue"}
								</ThemedText>
							</TouchableOpacity>
						</View>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	background: {
		position: "absolute",
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
	},
	scrollContent: {
		flexGrow: 1,
		paddingBottom: 30,
	},
	header: {
		padding: 20,
		paddingTop: 40,
	},
	brandText: {
		fontSize: 20,
		fontWeight: "bold",
		color: "white",
		letterSpacing: 1,
	},
	contentContainer: {
		flex: 1,
		padding: 20,
		justifyContent: "center",
	},
	title: {
		fontSize: 32,
		fontWeight: "bold",
		color: "white",
		marginBottom: 10,
	},
	subtitle: {
		fontSize: 14,
		color: "rgba(255,255,255,0.7)",
		marginBottom: 40,
	},
	linkText: {
		color: "#5D3FD3",
		fontWeight: "bold",
	},
	inputContainer: {
		width: "100%",
		gap: 16,
		marginBottom: 20,
	},
	input: {
		height: 50,
		borderRadius: 12,
		paddingHorizontal: 16,
		fontSize: 16,
		backgroundColor: "rgba(30,30,40,0.8)",
		color: "white",
	},
	button: {
		height: 50,
		borderRadius: 25,
		justifyContent: "center",
		alignItems: "center",
		marginTop: 10,
		backgroundColor: "#0A84FF",
	},
	disabledButton: {
		opacity: 0.7,
	},
	buttonText: {
		color: "white",
		fontSize: 16,
		fontWeight: "bold",
	},
});
