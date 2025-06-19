import { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  FlatList,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { QrCode, MessageSquare } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { CameraView, useCameraPermissions } from 'expo-camera';

const mockCounselors = [
  {
    id: 'counselor1',
    name: 'Dr. Emily Carter',
    specialty: 'Anxiety & Stress',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    id: 'counselor2',
    name: 'James Rodriguez',
    specialty: 'Relationships',
    avatar: 'https://randomuser.me/api/portraits/men/46.jpg',
  },
  {
    id: 'counselor3',
    name: 'Dr. Aisha Khan',
    specialty: 'Depression',
    avatar: 'https://randomuser.me/api/portraits/women/47.jpg',
  },
  {
    id: 'counselor4',
    name: 'Samuel Jones',
    specialty: 'Academic Pressure',
    avatar: 'https://randomuser.me/api/portraits/men/52.jpg',
  },
];

export default function CampusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, grantCampusAccess } = useAuth();
  const [showScanner, setShowScanner] = useState(false);

  const [permission, requestPermission] =
    Platform.OS !== 'web' ? useCameraPermissions() : [null, () => {}];

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    try {
      const scannedData = JSON.parse(data);
      if (scannedData.campusId) {
        grantCampusAccess(scannedData.campusId);
        setShowScanner(false);
      } else {
        console.error('QR code does not contain a campusId');
      }
    } catch (err) {
      console.error('Invalid QR code format', err);
    }
  };

  const handleStartChat = (counselorId: string) => {
    router.push(`/conversation/${counselorId}`);
  };

  if (user?.campusId) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, backgroundColor: '#F9FAFB' },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Counselors</Text>
          <Text style={styles.campusIdText}>Campus ID: {user.campusId}</Text>
        </View>
        <FlatList
          data={mockCounselors}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={styles.counselorCard}>
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
              <View style={styles.counselorInfo}>
                <Text style={styles.counselorName}>{item.name}</Text>
                <Text style={styles.counselorSpecialty}>{item.specialty}</Text>
              </View>
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => handleStartChat(item.id)}
              >
                <MessageSquare size={24} color="#3B82F6" />
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    );
  }

  if (Platform.OS !== 'web' && showScanner) {
    if (!permission?.granted) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.message}>
              We need camera permission to scan QR codes
            </Text>
            <TouchableOpacity style={styles.button} onPress={requestPermission}>
              <Text style={styles.buttonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setShowScanner(false)}
            >
              <Text style={styles.secondaryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.overlay}>
            <Text style={styles.scannerText}>Scan Campus QR Code</Text>
          </View>
        </CameraView>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => setShowScanner(false)}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Bridging Barz</Text>
        <Text style={styles.message}>
          To access counselors, please scan the QR code on your school premises.
        </Text>

        {Platform.OS !== 'web' ? (
          <TouchableOpacity
            style={styles.button}
            onPress={() => setShowScanner(true)}
          >
            <QrCode size={24} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Scan QR Code</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.message}>
            QR code scanning is not available on web. Please use the mobile app.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  campusIdText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  counselorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  counselorInfo: {
    flex: 1,
  },
  counselorName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  counselorSpecialty: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  chatButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scannerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  cancelButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
});
