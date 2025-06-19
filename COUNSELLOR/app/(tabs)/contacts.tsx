import { ThemedText } from "@/components/ThemedText";
import { LinearGradient } from "expo-linear-gradient";
import { router, useNavigation } from "expo-router";
import React, { useEffect } from "react";
import {
	FlatList,
	Platform,
	StatusBar,
	StyleSheet,
	TouchableOpacity,
	View,
} from "react-native";

// Dummy data for example
const DUMMY_CONTACTS = [
	{
		id: "1",
		name: "Alice Wonderland",
		avatar: "https://i.pravatar.cc/150?u=alice",
	},
	{
		id: "2",
		name: "Bob The Builder",
		avatar: "https://i.pravatar.cc/150?u=bob",
	},
	{
		id: "3",
		name: "Charlie Brown",
		avatar: "https://i.pravatar.cc/150?u=charlie",
	},
];

export default function ContactsScreen() {
	const navigation = useNavigation();

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

	const handlePressContact = (contact: { id: string; name: string }) => {
		console.log("Navigating to chat with:", contact.name);
		router.push({
			pathname: `/chat/${contact.id}`,
			params: { contactName: contact.name },
		});
	};

	const renderItem = ({ item }: { item: { id: string; name: string } }) => (
		<TouchableOpacity
			style={styles.contactItem}
			onPress={() => handlePressContact(item)}>
			{/* You could add an Avatar component here using item.avatar. Make sure avatar styles are dark-theme friendly */}
			<ThemedText style={styles.contactName}>{item.name}</ThemedText>
		</TouchableOpacity>
	);

	return (
		<View style={styles.container}>
			<StatusBar
				barStyle={Platform.OS === "ios" ? "light-content" : "light-content"}
			/>
			<LinearGradient
				colors={["#000000", "#200040", "#400060"]}
				style={StyleSheet.absoluteFill}
			/>
			<FlatList
				data={DUMMY_CONTACTS}
				renderItem={renderItem}
				keyExtractor={(item) => item.id}
				style={styles.list}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 20,
		color: "#FFFFFF",
		paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
	},
	list: {
		flex: 1,
	},
	contactItem: {
		paddingVertical: 15,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255,255,255,0.1)",
		flexDirection: "row",
		alignItems: "center",
	},
	contactName: {
		fontSize: 18,
		color: "rgba(255,255,255,0.9)",
	},
});
