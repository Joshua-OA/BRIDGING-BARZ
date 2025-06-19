import { ThemedText } from "@/components/ThemedText"; // Assuming this handles dark theme text well
import { Ionicons } from "@expo/vector-icons";
// import Constants from "expo-constants"; // No longer needed for the key here if hardcoding
import { LinearGradient } from "expo-linear-gradient"; // For background
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	KeyboardAvoidingView,
	Platform,
	SafeAreaView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";

// --- Configuration for OpenRouter ---
const OPENROUTER_API_KEY =
	"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"; // <--- HARDCODE YOUR KEY HERE FOR TESTING
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const AI_MODEL = "mistralai/mistral-7b-instruct"; // Or choose another model like "openai/gpt-3.5-turbo"

interface Message {
	_id: string | number;
	text: string;
	createdAt: Date;
	user: {
		_id: string | number; // 'currentUser' for the app user, 'aiAssistant' for the AI
		name?: string;
	};
	isError?: boolean; // Optional: to mark error messages from AI
}

const CURRENT_USER_ID = "currentUser";
const AI_ASSISTANT_ID = "aiAssistant";

// Helper for typing animation
const TypingIndicator = ({ name }: { name: string }) => {
	const [dots, setDots] = useState(".");
	useEffect(() => {
		const interval = setInterval(() => {
			setDots((prevDots) => {
				if (prevDots === "...") return ".";
				return prevDots + ".";
			});
		}, 400); // Adjust speed as needed
		return () => clearInterval(interval);
	}, []);

	return (
		<ThemedText style={styles.typingIndicator}>
			{name} is typing{dots}
		</ThemedText>
	);
};

export default function ChatDetailScreen() {
	const { contactId: routeContactId, contactName: routeContactName } =
		useLocalSearchParams<{
			contactId?: string;
			contactName?: string;
		}>();
	const navigation = useNavigation();
	const flatListRef = useRef<FlatList>(null);

	const contactId = routeContactId || AI_ASSISTANT_ID; // Default to AI if no contactId
	const contactName = routeContactName || "AI Assistant";

	const [messages, setMessages] = useState<Message[]>([]);
	const [inputText, setInputText] = useState("");
	const [isLoadingInitialMessages, setIsLoadingInitialMessages] =
		useState(false);
	const [isAiTyping, setIsAiTyping] = useState(false);

	useEffect(() => {
		navigation.setOptions({
			title: contactName || "Chat",
			headerStyle: {
				backgroundColor: "#100020", // Dark header
			},
			headerTintColor: "#FFFFFF", // Light text/icons in header
			headerTitleStyle: {
				color: "#FFFFFF",
			},
			headerLeft: () => (
				<TouchableOpacity
					onPress={() => {
						if (navigation.canGoBack()) {
							navigation.goBack();
						} else {
							// Navigate to a default route, e.g., the first tab or contacts list
							// Adjust '/(tabs)/contacts' if your route is different
							router.replace("/(tabs)/contacts");
						}
					}}
					style={{ marginLeft: 15 }}>
					<Ionicons name="arrow-back" size={24} color="#FFFFFF" />
				</TouchableOpacity>
			),
		});
	}, [navigation, contactName]);

	// Simulate loading initial messages or a welcome message from AI
	useEffect(() => {
		setIsLoadingInitialMessages(true);
		setTimeout(() => {
			setMessages(
				[
					{
						_id: Date.now(),
						text: `You are now chatting with ${
							contactName === "AI Assistant" ? "your AI Counselor" : contactName
						}. How can I help you today?`, // Updated welcome message
						createdAt: new Date(),
						user: { _id: AI_ASSISTANT_ID, name: contactName },
					},
				].reverse()
			);
			setIsLoadingInitialMessages(false);
		}, 500);
	}, [contactName]);

	const addMessage = (message: Message) => {
		setMessages((previousMessages) => [message, ...previousMessages]);
	};

	const getAiResponse = async (currentMessages: Message[]) => {
		if (!OPENROUTER_API_KEY) {
			Alert.alert(
				"API Key Missing",
				"The OPENROUTER_API_KEY is missing in app/chat/[contactId].tsx."
			);
			addMessage({
				_id: Date.now(),
				text: "OpenRouter API Key not configured. I can't respond.",
				createdAt: new Date(),
				user: { _id: AI_ASSISTANT_ID, name: contactName },
				isError: true,
			});
			return;
		}

		setIsAiTyping(true);

		// Prepare messages for OpenRouter API
		// It wants roles 'system', 'user', 'assistant'
		const apiMessages = currentMessages
			.slice(0, 10) // Send last 10 messages to keep context manageable & avoid large payloads
			.reverse() // API expects chronological order (oldest first)
			.map((msg) => ({
				role: msg.user._id === CURRENT_USER_ID ? "user" : "assistant",
				content: msg.text,
			}));

		// Optional: Add a system message for context/priming the AI
		const systemMessage = {
			role: "system",
			content: `You are an AI Counselor. Your name is ${contactName}. You are empathetic, supportive, and provide guidance. Do not break character.`, // Counselor persona
		};

		try {
			const response = await fetch(OPENROUTER_API_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${OPENROUTER_API_KEY}`,
					"Content-Type": "application/json",
					// Optional: Add HTTP Referer or X-Title for OpenRouter analytics
					// "HTTP-Referer": "YOUR_APP_URL_OR_ID",
					// "X-Title": "Your App Name",
				},
				body: JSON.stringify({
					model: AI_MODEL,
					messages: [systemMessage, ...apiMessages],
				}),
			});

			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ message: response.statusText }));
				throw new Error(
					errorData.error?.message ||
						errorData.message ||
						`API request failed with status ${response.status}`
				);
			}

			const data = await response.json();
			const aiText = data.choices[0]?.message?.content?.trim();

			if (aiText) {
				addMessage({
					_id: data.id || Date.now(),
					text: aiText,
					createdAt: new Date(),
					user: { _id: AI_ASSISTANT_ID, name: contactName },
				});
			} else {
				throw new Error("AI response was empty or in an unexpected format.");
			}
		} catch (error: any) {
			console.error("Error fetching AI response:", error);
			addMessage({
				_id: Date.now(),
				text: `Sorry, I encountered an error: ${error.message}`,
				createdAt: new Date(),
				user: { _id: AI_ASSISTANT_ID, name: contactName },
				isError: true,
			});
		} finally {
			setIsAiTyping(false);
		}
	};

	const handleSendPress = () => {
		if (inputText.trim().length === 0) return;

		const userMessage: Message = {
			_id: Date.now().toString(),
			text: inputText.trim(),
			createdAt: new Date(),
			user: { _id: CURRENT_USER_ID },
		};
		addMessage(userMessage);
		setInputText("");

		// Trigger AI response after a short delay to allow UI update
		setTimeout(() => {
			const updatedMessages = [userMessage, ...messages]; // Pass current state of messages
			getAiResponse(updatedMessages);
		}, 100);
	};

	const renderMessageItem = ({ item }: { item: Message }) => {
		const isMyMessage = item.user._id === CURRENT_USER_ID;
		return (
			<View
				style={[
					styles.messageRow,
					isMyMessage ? styles.myMessageRow : styles.otherMessageRow,
					item.isError && styles.errorBubble,
				]}>
				<View
					style={[
						styles.messageBubble,
						isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
					]}>
					<ThemedText
						style={
							isMyMessage ? styles.myMessageText : styles.otherMessageText
						}>
						{item.text}
					</ThemedText>
					<Text
						style={
							isMyMessage ? styles.myMessageTime : styles.otherMessageTime
						}>
						{item.createdAt.toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</Text>
				</View>
			</View>
		);
	};

	useEffect(() => {
		if (flatListRef.current && messages.length > 0) {
			flatListRef.current.scrollToOffset({ animated: true, offset: 0 });
		}
	}, [messages]);

	if (isLoadingInitialMessages) {
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

	if (!contactId && !routeContactName) {
		return (
			<View style={[styles.container, styles.centered]}>
				<LinearGradient
					colors={["#000000", "#200040", "#400060"]}
					style={StyleSheet.absoluteFill}
				/>
				<ThemedText>Contact ID not found.</ThemedText>
			</View>
		);
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<LinearGradient
				colors={["#000000", "#200040", "#400060"]}
				style={StyleSheet.absoluteFill}
			/>
			<KeyboardAvoidingView
				style={styles.container}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} // Adjust this value as needed
			>
				<FlatList
					ref={flatListRef}
					data={messages}
					renderItem={renderMessageItem}
					keyExtractor={(item) => item._id.toString()}
					style={styles.messagesList}
					inverted
					contentContainerStyle={{ paddingVertical: 10 }}
					ListFooterComponent={
						isAiTyping ? <TypingIndicator name={contactName} /> : null
					}
				/>
				<View style={styles.inputToolbar}>
					<TextInput
						style={styles.textInput}
						placeholder="Type a message..."
						placeholderTextColor="rgba(255,255,255,0.5)"
						value={inputText}
						onChangeText={setInputText}
						multiline
						selectionColor="#0A84FF"
						editable={!isAiTyping} // Disable input while AI is typing
					/>
					<TouchableOpacity
						style={[styles.sendButton, isAiTyping && styles.disabledButton]}
						onPress={handleSendPress}
						disabled={isAiTyping}>
						<Ionicons name="send" size={22} color="#FFFFFF" />
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#100020", // Fallback for SafeAreaView background
	},
	container: {
		flex: 1,
	},
	centered: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	messagesList: {
		flex: 1,
		paddingHorizontal: 10,
	},
	inputToolbar: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderTopWidth: 1,
		borderTopColor: "rgba(255,255,255,0.1)", // Lighter border for dark theme
		backgroundColor: "#100020", // Dark background for input area
	},
	textInput: {
		flex: 1,
		minHeight: 40,
		maxHeight: 120,
		backgroundColor: "rgba(40,20,60,0.8)", // Darker input field
		borderRadius: 20,
		paddingHorizontal: 15,
		paddingVertical: Platform.OS === "ios" ? 10 : 5, // Adjusted padding for Android multiline
		fontSize: 16,
		marginRight: 10,
		color: "white", // Light text color
	},
	sendButton: {
		backgroundColor: "#0A84FF", // Primary action color
		borderRadius: 20,
		height: 40,
		width: 40,
		justifyContent: "center",
		alignItems: "center",
	},
	disabledButton: {
		// Style for disabled send button
		opacity: 0.5,
	},
	messageRow: {
		flexDirection: "row",
		marginBottom: 10,
		// Max width for message bubbles is now controlled by the bubble itself
	},
	myMessageRow: {
		justifyContent: "flex-end", // Align to the right
		alignSelf: "flex-end",
		maxWidth: "70%", // Apply maxWidth here for the row
	},
	otherMessageRow: {
		justifyContent: "flex-start", // Align to the left
		alignSelf: "flex-start",
		maxWidth: "70%", // Apply maxWidth here for the row
	},
	messageBubble: {
		paddingHorizontal: 15,
		paddingVertical: 10,
		borderRadius: 18,
	},
	myMessageBubble: {
		backgroundColor: "#0A84FF", // Your primary theme color for sent messages
		borderBottomRightRadius: 4,
	},
	otherMessageBubble: {
		backgroundColor: "#301050", // A darker purple/gray for received messages
		borderBottomLeftRadius: 4,
	},
	errorBubble: {
		// Style for error messages from AI
		backgroundColor: "#8B0000", // Dark red
	},
	myMessageText: {
		fontSize: 16,
		color: "white",
	},
	otherMessageText: {
		fontSize: 16,
		color: "rgba(255,255,255,0.9)", // Slightly off-white for received
	},
	myMessageTime: {
		fontSize: 10,
		color: "rgba(255,255,255,0.6)",
		alignSelf: "flex-end",
		marginTop: 3,
	},
	otherMessageTime: {
		fontSize: 10,
		color: "rgba(255,255,255,0.5)",
		alignSelf: "flex-end", // Or flex-start if preferred for other messages
		marginTop: 3,
	},
	typingIndicator: {
		// Style for the new typing indicator
		paddingVertical: 10,
		textAlign: "center",
		color: "rgba(255,255,255,0.6)",
		fontSize: 14,
	},
});
