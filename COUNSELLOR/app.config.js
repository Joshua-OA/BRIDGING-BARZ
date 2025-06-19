export default {
	name: "nerd_23-app",
	slug: "nerd_23-app",
	version: "1.0.0",
	orientation: "portrait",
	extra: {
		apiUrl: process.env.API_URL || "https://api.example.com",
	},
	plugins: ["expo-barcode-scanner", "expo-secure-store"],
};
