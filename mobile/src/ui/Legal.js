// In-app Privacy Policy and Terms of Use (the same text the web build serves at
// ?legal=privacy and ?legal=terms, which is the public URL given to the app stores).
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { LEGAL_UPDATED, legalDocuments } from '../core';
import { Button, Sheet, T } from './primitives';

export const LEGAL = legalDocuments({ supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || null, native: true });

function Document({ doc }) {
  const d = LEGAL[doc];
  return (
    <View style={{ paddingBottom: 16 }} testID={`legal-${doc}`}>
      <T muted size={12.5}>
        Last updated {LEGAL_UPDATED}
      </T>
      <T size={15} lh={1.5} style={{ marginTop: 12 }}>
        {d.intro}
      </T>
      {d.sections.map((s) => (
        <View key={s.h} style={{ marginTop: 24 }}>
          <T size={16} w={600}>
            {s.h}
          </T>
          {s.p.map((para) => (
            <T key={para.slice(0, 40)} muted size={14.5} lh={1.5} style={{ marginTop: 8 }}>
              {para}
            </T>
          ))}
        </View>
      ))}
    </View>
  );
}

export function LegalSheet({ doc, onClose }) {
  return (
    <Sheet title={LEGAL[doc].title} onClose={onClose}>
      <Document doc={doc} />
      <Button title="Close" onPress={onClose} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

export function LegalLinks({ onOpen, style }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }, style]}>
      <TouchableOpacity onPress={() => onOpen('privacy')} accessibilityRole="link" hitSlop={8}>
        <T size={13} style={{ textDecorationLine: 'underline' }}>
          Privacy Policy
        </T>
      </TouchableOpacity>
      <T muted size={13}>
        ·
      </T>
      <TouchableOpacity onPress={() => onOpen('terms')} accessibilityRole="link" hitSlop={8}>
        <T size={13} style={{ textDecorationLine: 'underline' }}>
          Terms of Use (16+)
        </T>
      </TouchableOpacity>
    </View>
  );
}
