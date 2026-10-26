import React, { useRef, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ArrowRight, ChevronRight, Plus, ScanLine, X } from 'lucide-react-native';
import { DNA_STYLES, dnaInfo } from '../../core';
import { roomBadges } from '../../lib/database';
import { codeFromInvite } from '../../lib/platform';
import { useTheme } from '../../theme';
import { Button, Card, CodeInput, Divided, IconButton, LevelDots, Screen, ScreenHeader, SectionLabel, T } from '../primitives';

// Native QR scanner (expo-camera barcode scanning): reads a room invite link or code.
function QrScanner({ onCode, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);
  const granted = permission?.granted;
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }} testID="qr-scanner">
        {granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              const code = codeFromInvite(data);
              if (code && !done.current) {
                done.current = true;
                onCode(code);
              }
            }}
          />
        ) : null}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: 256, height: 256, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' }} />
        </View>
        <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12 }}>
            <T size={17} w={600} color="#fff">
              Scan room QR
            </T>
            <IconButton icon={X} label="Close scanner" onPress={onClose} />
          </View>
          <View style={{ flex: 1 }} pointerEvents="none" />
          <View style={{ paddingHorizontal: 24, paddingBottom: 32, alignItems: 'center', gap: 16 }}>
            {permission && !granted ? (
              <Button
                title={permission.canAskAgain ? 'Allow camera' : 'Camera blocked in Settings'}
                disabled={!permission.canAskAgain}
                onPress={requestPermission}
                style={{ alignSelf: 'stretch' }}
              />
            ) : null}
            <T size={14} color="rgba(255,255,255,0.7)" center>
              {permission && !granted ? 'Camera unavailable. Type the 4-digit code instead.' : 'Point your camera at the QR code on the host’s phone.'}
            </T>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default function Play({ account, onCreate, onJoin }) {
  const t = useTheme();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const rooms = roomBadges(account.id)
    .filter((r) => r.hosted)
    .slice(0, 3);
  const first = account.name.split(' ')[0];

  return (
    <Screen testID="tab-play">
      <ScreenHeader subtitle={`Hey ${first}`} title="Play" />

      <Card onPress={() => onCreate()} testID="create-room" accessibilityLabel="Create a room" inner={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.c.fg, alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={22} strokeWidth={2.5} color={t.c.bg} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={17} w={600}>
            Create a room
          </T>
          <T muted size={14} style={{ marginTop: 2 }}>
            Host a squad and spin the first mission
          </T>
        </View>
        <ChevronRight size={20} color={t.c.muted} />
      </Card>

      <SectionLabel>Join a room</SectionLabel>
      <Card inner={{ padding: 20 }}>
        <CodeInput value={code} onChange={setCode} testID="join-code" />
        <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
          <Button variant="secondary" icon={ScanLine} accessibilityLabel="Scan QR code" onPress={() => setScanning(true)} style={{ width: 56, paddingHorizontal: 0 }} testID="scan-qr" />
          <View style={{ flex: 1 }}>
            <Button title="Join" iconRight={ArrowRight} disabled={code.length !== 4} onPress={() => onJoin(code)} testID="join-room" />
          </View>
        </View>
      </Card>

      {rooms.length > 0 && (
        <>
          <SectionLabel>Your rooms</SectionLabel>
          <Card>
            <Divided>
              {rooms.map((r) => {
                const info = dnaInfo(r.dna);
                return (
                  <TouchableOpacity key={r.code} onPress={() => onCreate(r.code)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16 }}>
                    <T size={20} w={600} ls={1.6} tnum>
                      {r.code}
                    </T>
                    <T muted size={14} numberOfLines={1} style={{ flex: 1 }}>
                      {DNA_STYLES[info.style].name}
                    </T>
                    <LevelDots stage={info.stage} />
                    <ChevronRight size={18} color={t.c.muted} />
                  </TouchableOpacity>
                );
              })}
            </Divided>
          </Card>
        </>
      )}

      {scanning && (
        <QrScanner
          onClose={() => setScanning(false)}
          onCode={(c) => {
            setScanning(false);
            onJoin(c);
          }}
        />
      )}
    </Screen>
  );
}
