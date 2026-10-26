// IRL safety warning: shown on first launch and before every outdoor or dark round.
import React from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { PREFS, getPref, setPref } from '../lib/database';
import { T } from './primitives';

export const safetyAccepted = () => !!getPref(PREFS.safety);
export const acceptSafety = () => setPref(PREFS.safety, Date.now());

export default function SafetyGate({ onAgree, extra, onTerms, children }) {
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }} testID="safety-gate" accessibilityRole="alert">
        <View style={{ width: '100%', maxWidth: 380, borderRadius: 28, borderWidth: 2, borderColor: '#fff', backgroundColor: '#000', paddingHorizontal: 24, paddingBottom: 24, paddingTop: 28, alignItems: 'center' }}>
          <TriangleAlert size={34} color="#fff" />
          <T size={12} w={600} ls={2.2} color="rgba(255,255,255,0.6)" style={{ marginTop: 12 }}>
            IRL SAFETY WARNING
          </T>
          <T size={22} w={700} ls={-0.4} color="#fff" style={{ marginTop: 12 }}>
            PLAY SAFELY
          </T>
          <T size={15} lh={1.5} color="rgba(255,255,255,0.85)" center style={{ marginTop: 12 }}>
            Always stay aware of your physical surroundings. Do not trespass, do not run near traffic or stairs in the dark, and obey all local laws.
          </T>
          {extra ? (
            <T size={13.5} lh={1.35} color="rgba(255,255,255,0.7)" center style={{ marginTop: 12 }}>
              {extra}
            </T>
          ) : null}
          <TouchableOpacity
            onPress={onAgree}
            activeOpacity={0.85}
            testID="safety-agree"
            accessibilityRole="button"
            style={{ marginTop: 24, height: 56, alignSelf: 'stretch', borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
          >
            <T size={16} w={600} color="#000">
              I Understand & Agree
            </T>
          </TouchableOpacity>
          {onTerms ? (
            <TouchableOpacity onPress={onTerms} style={{ marginTop: 8, height: 40, justifyContent: 'center' }} accessibilityRole="link">
              <T size={13} color="rgba(255,255,255,0.6)" style={{ textDecorationLine: 'underline' }}>
                Read the Terms of Use
              </T>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {children}
    </Modal>
  );
}
