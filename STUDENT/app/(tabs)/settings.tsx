import { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Wallet,
  Key,
  Shield,
  LogOut,
  Phone,
  AlertTriangle,
  X,
} from 'lucide-react-native';
import SettingsItem from '@/components/settings/SettingsItem';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [tempPhoneNumber, setTempPhoneNumber] = useState('');

  // Simulated wallet data - in a real app, this would come from your Cardano wallet connection
  const walletData = {
    address: 'addr1qxy8p...',
    balance: '150 ADA',
    network: 'Mainnet',
  };

  const handleEmergencyPress = () => {
    Alert.alert(
      'Emergency Services',
      'This feature is intended for emergencies only. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: () => console.log('Emergency service contacted'),
          style: 'destructive',
        },
      ]
    );
  };

  const openPhoneModal = () => {
    setTempPhoneNumber(phoneNumber || '+233 ');
    setModalVisible(true);
  };

  const handleSavePhoneNumber = () => {
    setPhoneNumber(tempPhoneNumber);
    setModalVisible(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Modal
        animationType="fade"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Emergency Contact</Text>
              <Text style={styles.modalText}>
                Your phone number is only used to help you in case of
                emergencies and for no other reason.
              </Text>
              <Text style={styles.modalSubText}>
                Your number is never shared unless with the appropriate
                emergency services.
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="+233 (0) XX XXX XXXX"
                value={tempPhoneNumber}
                onChangeText={setTempPhoneNumber}
                keyboardType="phone-pad"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSavePhoneNumber}
              >
                <Text style={styles.saveButtonText}>Save Number</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <SettingsItem
            icon={<Key size={22} color="#6B7280" />}
            title="User ID"
            subtitle={user?.id || 'Not available'}
          />
          <SettingsItem
            icon={<Phone size={22} color="#6B7280" />}
            title="Phone Number"
            subtitle={phoneNumber || 'Not set'}
            onPress={openPhoneModal}
            showArrow
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wallet</Text>

          <SettingsItem
            icon={<Wallet size={22} color="#6B7280" />}
            title="Wallet Address"
            subtitle={walletData.address}
          />

          <SettingsItem
            icon={<Shield size={22} color="#6B7280" />}
            title="Network"
            subtitle={walletData.network}
          />

          <View style={styles.balanceCard}>
            <Text style={styles.balanceTitle}>Current Balance</Text>
            <Text style={styles.balanceAmount}>{walletData.balance}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={signOut}>
          <Wallet size={20} color="#3B82F6" />
          <Text style={styles.actionButtonText}>Disconnect Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={signOut}>
          <LogOut size={20} color="#6B7280" />
          <Text style={styles.actionButtonText}>Logout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.emergencyButton]}
          onPress={handleEmergencyPress}
        >
          <AlertTriangle size={20} color="#FFFFFF" />
          <Text style={[styles.actionButtonText, styles.emergencyButtonText]}>
            Emergency Services
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 8,
    paddingLeft: 8,
  },
  settingsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 68,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  modalInput: {
    height: 50,
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  balanceCard: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  balanceTitle: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    opacity: 0.9,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonText: {
    marginLeft: 8,
    color: '#374151',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  emergencyButton: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
    marginTop: 16,
    marginBottom: 32,
  },
  emergencyButtonText: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
});
