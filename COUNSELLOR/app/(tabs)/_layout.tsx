import { Ionicons } from "@expo/vector-icons"; // Or any icon library you prefer
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: "#0A84FF", // Example active color
				// headerShown: false, // Uncomment if you manage headers in each screen
				tabBarStyle: {
					backgroundColor: Platform.OS === "ios" ? "#FFFFFF" : "#F0F0F0", // Example background
				},
			}}>
			<Tabs.Screen
				name="contacts"
				options={{
					title: "Contacts",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="people-outline" color={color} size={size} />
					),
				}}
			/>
			<Tabs.Screen
				name="chat"
				options={{
					title: "Chat",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="chatbubbles-outline" color={color} size={size} />
					),
					// Example: tabBarBadge: 3, // If you want to show a badge
				}}
			/>
			<Tabs.Screen
				name="settings"
				options={{
					title: "Settings",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="settings-outline" color={color} size={size} />
					),
				}}
			/>
		</Tabs>
	);
}
