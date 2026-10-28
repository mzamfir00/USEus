// Native building blocks: text, buttons, cards, inputs, sheets (Modal) and the Room DNA
// background layers. Everything reads colours and fonts from the theme context.
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Line, Pattern, Polygon, Rect } from 'react-native-svg';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { inter, MONO, MONO_BOLD, RADIUS, SERIF, SERIF_ITALIC, useTheme } from '../theme';

/* ---------------------------------- text ---------------------------------- */

export function T({ size = 15, w = 400, color, muted, faint, inverse, mono, serif, italic, center, upper, tnum, lh, ls, style, children, ...rest }) {
  const t = useTheme();
  const fontFamily = serif ? (italic ? SERIF_ITALIC : SERIF) : mono ? (w >= 600 ? MONO_BOLD : MONO) : inter(w);
  return (
    <Text
      {...rest}
      style={[
        {
          color: color || (muted ? t.c.muted : faint ? t.c.faint : inverse ? t.c.bg : t.c.fg),
          fontSize: size,
          fontFamily,
          lineHeight: lh ? Math.round(size * lh) : undefined,
          letterSpacing: ls,
          textAlign: center ? 'center' : undefined,
          textTransform: upper ? 'uppercase' : undefined,
          fontVariant: tnum ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// Room-DNA aware display type (.title / .headline in the web app).
export function Title({ size = 34, style, children, ...rest }) {
  const t = useTheme();
  return (
    <Text {...rest} style={[{ color: t.c.fg, fontSize: size, lineHeight: Math.round(size * 1.08) }, t.title, style]}>
      {children}
    </Text>
  );
}

export function Eyebrow({ style, children, color, ...rest }) {
  const t = useTheme();
  return (
    <Text {...rest} style={[{ color: color || t.c.muted }, t.eyebrow, style]}>
      {children}
    </Text>
  );
}

/* --------------------------------- layout --------------------------------- */

// Scrollable tab screen with the safe-area top inset.
// Each tab screen is opaque and draws its own Room DNA layers (inactive tabs stay mounted).
export function Screen({ children, scroll = true, contentStyle, refreshControl, testID }) {
  const t = useTheme();
  if (!scroll) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.c.bg }} testID={testID}>
        <BgFx />
        <View style={[{ flex: 1, paddingHorizontal: 24 }, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.c.bg }} testID={testID}>
      <BgFx />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        contentContainerStyle={[{ paddingHorizontal: 24, paddingBottom: 40 }, contentStyle]}
        indicatorStyle={t.c.bg === '#000000' ? 'white' : 'black'}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Row({ children, style, gap = 8, center = true }) {
  return <View style={[{ flexDirection: 'row', alignItems: center ? 'center' : 'flex-start', gap }, style]}>{children}</View>;
}

export function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingBottom: 24, paddingTop: 20 }}>
      <View style={{ flexShrink: 1 }}>
        {subtitle ? <Eyebrow style={{ marginBottom: 4 }}>{subtitle}</Eyebrow> : null}
        <Title accessibilityRole="header">{title}</Title>
      </View>
      {right}
    </View>
  );
}

export function SectionLabel({ children, right, style }) {
  return (
    <View style={[{ marginBottom: 12, marginTop: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }, style]}>
      <Eyebrow>{children}</Eyebrow>
      {right}
    </View>
  );
}

/* -------------------------------- surfaces -------------------------------- */

function Perforations({ color }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 20, right: 20, top: 6, height: 4, flexDirection: 'row', overflow: 'hidden', gap: 9 }}>
      {Array.from({ length: 40 }, (_, i) => (
        <View key={i} style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
}

export function Card({ children, style, onPress, onLongPress, disabled, testID, accessibilityLabel, inner }) {
  const t = useTheme();
  const box = [
    {
      backgroundColor: t.c.card,
      borderWidth: 1,
      borderColor: t.c.border,
      borderRadius: RADIUS,
      borderStyle: t.dashed ? 'dashed' : 'solid',
      overflow: 'hidden',
    },
    inner,
  ];
  const content = (
    <>
      {t.perforations && <Perforations color="#3a3a3a" />}
      {children}
    </>
  );
  const body = onPress ? (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} onLongPress={onLongPress} disabled={disabled} style={box} testID={testID} accessibilityLabel={accessibilityLabel} accessibilityRole="button">
      {content}
    </TouchableOpacity>
  ) : (
    <View style={box} testID={testID} accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
  if (!t.hardShadow) return <View style={style}>{body}</View>;
  return (
    <View style={[{ marginRight: 4, marginBottom: 4 }, style]}>
      <View style={{ position: 'absolute', left: 4, top: 4, right: -4, bottom: -4, borderRadius: RADIUS, backgroundColor: t.c.fg }} />
      {body}
    </View>
  );
}

// Rows separated by hairlines (.divide).
export function Divided({ children }) {
  const t = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return items.map((child, i) => (
    <View key={child.key ?? i} style={i ? { borderTopWidth: 1, borderTopColor: t.c.border } : null}>
      {child}
    </View>
  ));
}

/* --------------------------------- buttons -------------------------------- */

export function Button({ title, children, onPress, variant = 'primary', disabled, icon: Icon, iconRight: IconRight, style, small, testID, color, bg, accessibilityLabel }) {
  const t = useTheme();
  const primary = variant === 'primary';
  const fg = color || (primary ? t.c.bg : t.c.fg);
  const background = bg || (primary ? t.c.fg : variant === 'secondary' ? t.c.card : 'transparent');
  const btn = (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof title === 'string' ? title : undefined)}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        {
          minHeight: small ? 44 : 56,
          borderRadius: 999,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: background,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: t.c.border,
          opacity: disabled ? 0.3 : 1,
        },
        style,
      ]}
    >
      {Icon ? <Icon size={small ? 16 : 18} color={fg} strokeWidth={2.2} /> : null}
      {title != null ? (
        <T size={small ? 14.5 : 16} w={600} color={fg} ls={-0.16} numberOfLines={1}>
          {title}
        </T>
      ) : null}
      {children}
      {IconRight ? <IconRight size={18} color={fg} strokeWidth={2.2} /> : null}
    </TouchableOpacity>
  );
  if (!(primary && t.hardShadow && !bg)) return btn;
  return (
    <View style={{ marginRight: 4, marginBottom: 4 }}>
      <View style={{ position: 'absolute', left: 4, top: 4, right: -4, bottom: -4, borderRadius: 999, backgroundColor: '#555' }} />
      {btn}
    </View>
  );
}

export function IconButton({ icon: Icon, onPress, label, size = 40, iconSize = 18, style, disabled, testID, inverted, children }) {
  const t = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      activeOpacity={0.7}
      hitSlop={6}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: inverted ? t.c.fg : t.c.card,
          borderWidth: 1,
          borderColor: inverted ? t.c.fg : t.c.border,
          opacity: disabled ? 0.35 : 1,
        },
        style,
      ]}
    >
      {Icon ? <Icon size={iconSize} color={inverted ? t.c.bg : t.c.fg} /> : children}
    </TouchableOpacity>
  );
}

export function Pill({ label, on, onPress, icon: Icon, style, testID }) {
  const t = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={[
        {
          height: 36,
          paddingHorizontal: 16,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: on ? t.c.fg : t.c.border,
          backgroundColor: on ? t.c.fg : t.c.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        style,
      ]}
    >
      {Icon ? <Icon size={15} color={on ? t.c.bg : t.c.fg} /> : null}
      <T size={14} w={500} color={on ? t.c.bg : t.c.fg} numberOfLines={1}>
        {label}
      </T>
    </TouchableOpacity>
  );
}

/* --------------------------------- inputs --------------------------------- */

export const Field = React.forwardRef(function Field({ style, left, right, ...props }, ref) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View
      style={[
        {
          height: 56,
          borderRadius: 14,
          backgroundColor: t.c.card,
          borderWidth: 1,
          borderColor: focus ? t.c.fg : t.c.border,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
        },
        style,
      ]}
    >
      {left}
      <TextInput
        ref={ref}
        placeholderTextColor={t.c.faint}
        selectionColor={t.c.fg}
        cursorColor={t.c.fg}
        {...props}
        onFocus={(e) => {
          setFocus(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          props.onBlur?.(e);
        }}
        style={[{ flex: 1, color: t.c.fg, fontSize: 17, fontFamily: inter(400), height: '100%', paddingVertical: 0 }, props.inputStyle]}
      />
      {right}
    </View>
  );
});

export function Labeled({ label, hint, children, style }) {
  return (
    <View style={style}>
      <Eyebrow style={{ marginBottom: 8, paddingHorizontal: 4 }}>{label}</Eyebrow>
      {children}
      {hint ? (
        <T muted size={12.5} style={{ marginTop: 6, paddingHorizontal: 4 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function Segmented({ options, value, onChange, style, testID }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: t.c.card, borderWidth: 1, borderColor: t.c.border }, style]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            testID={o.testID}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.c.fg : 'transparent' }}
          >
            <T size={14} w={600} color={on ? t.c.bg : t.c.muted} numberOfLines={1}>
              {o.label}
            </T>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Switch({ value, onChange, disabled, label, testID }) {
  const t = useTheme();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [value, x]);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
      aria-checked={!!value}
      testID={testID}
      style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: value ? t.c.fg : t.c.border, opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 3,
          left: 3,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: value ? t.c.bg : t.c.muted,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }],
        }}
      />
    </TouchableOpacity>
  );
}

// Dropdown replacement: a field that opens a sheet with a list of options.
export function Select({ value, options, onChange, placeholder = 'Select', style, label, testID }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => String(o.value) === String(value));
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        style={[
          { height: 56, borderRadius: 14, backgroundColor: t.c.card, borderWidth: 1, borderColor: t.c.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
          style,
        ]}
      >
        <T size={16} color={current ? t.c.fg : t.c.faint} numberOfLines={1} style={{ flexShrink: 1 }}>
          {current ? current.short || current.label : placeholder}
        </T>
        <ChevronDown size={16} color={t.c.muted} />
      </TouchableOpacity>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)} scroll={false}>
          <FlatList
            data={options}
            keyExtractor={(o) => String(o.value)}
            style={{ maxHeight: Dimensions.get('window').height * 0.6 }}
            initialScrollIndex={Math.max(0, options.indexOf(current))}
            getItemLayout={(_, i) => ({ length: 52, offset: 52 * i, index: i })}
            renderItem={({ item }) => {
              const on = String(item.value) === String(value);
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: t.c.border }}
                >
                  <T size={16} w={on ? 600 : 400}>
                    {item.label}
                  </T>
                  {on && <Check size={18} color={t.c.fg} />}
                </TouchableOpacity>
              );
            }}
          />
        </Sheet>
      )}
    </>
  );
}

// 4-digit room code entry rendered as four cells over a hidden numeric input.
export function CodeInput({ value, onChange, onComplete, autoFocus, testID }) {
  const t = useTheme();
  const ref = useRef(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Room code">
      <View style={{ flexDirection: 'row', gap: 10 }} pointerEvents="none">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 72,
              borderRadius: 16,
              backgroundColor: t.c.card,
              borderWidth: 1,
              borderColor: i === Math.min(value.length, 3) ? t.c.fg : t.c.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T size={32} w={700} tnum>
              {value[i] || ''}
            </T>
          </View>
        ))}
      </View>
      <TextInput
        ref={ref}
        testID={testID}
        value={value}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={4}
        caretHidden
        onChangeText={(text) => {
          const v = text.replace(/\D/g, '').slice(0, 4);
          onChange(v);
          if (v.length === 4) onComplete?.(v);
        }}
        style={{ ...StyleSheet.absoluteFillObject, opacity: 0.011, color: 'transparent' }}
      />
    </Pressable>
  );
}

/* --------------------------------- sheets --------------------------------- */

// Bottom sheet built on the native Modal. The Android back button closes it.
export function Sheet({ title, onClose, children, scroll = true, testID, dismissable = true, footer }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  useEffect(() => {
    Animated.timing(y, { toValue: 0, duration: 320, easing: Easing.bezier(0.2, 0.9, 0.3, 1), useNativeDriver: true }).start();
  }, [y]);
  const close = dismissable ? onClose : undefined;
  const maxHeight = Dimensions.get('window').height * 0.9;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => close?.()}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} onPress={close} accessibilityLabel="Close" />
        <Animated.View
          testID={testID}
          style={{
            maxHeight,
            backgroundColor: t.c.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderColor: t.c.border,
            paddingTop: 12,
            transform: [{ translateY: y }],
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.c.border, marginBottom: 16 }} />
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 24, gap: 12 }}>
              <Title size={22} style={{ flexShrink: 1 }}>
                {title}
              </Title>
              {dismissable && <IconButton icon={X} label="Close" onPress={onClose} />}
            </View>
          ) : null}
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 + insets.bottom }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: 24, paddingBottom: 24 + insets.bottom }}>{children}</View>
          )}
          {footer}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------------------------------- misc ---------------------------------- */

export function Avatar({ name, size = 44, inverted = false }) {
  const t = useTheme();
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: inverted ? t.c.fg : '#1f1f1f',
        borderWidth: inverted ? 0 : 1,
        borderColor: t.c.border,
      }}
    >
      <T size={size * 0.36} w={600} color={inverted ? t.c.bg : t.c.fg}>
        {initials}
      </T>
    </View>
  );
}

export function Empty({ icon: Icon, title, body }) {
  const t = useTheme();
  return (
    <Card inner={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 }}>
      {Icon ? (
        <View style={{ marginBottom: 16, width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: t.c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={t.c.fg} />
        </View>
      ) : null}
      <T size={16} w={600} center>
        {title}
      </T>
      {body ? (
        <T muted size={14} center lh={1.35} style={{ marginTop: 6, maxWidth: 260 }}>
          {body}
        </T>
      ) : null}
    </Card>
  );
}

export function LevelDots({ stage }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`Level ${stage} of 3`}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: stage >= n ? t.c.fg : t.c.border }} />
      ))}
    </View>
  );
}

export function Notice({ children, style, testID }) {
  const t = useTheme();
  return (
    <View testID={testID} style={[{ borderRadius: 14, borderWidth: 1, borderColor: t.c.border, backgroundColor: t.c.card, paddingHorizontal: 16, paddingVertical: 12 }, style]}>
      {typeof children === 'string' ? (
        <T size={14} lh={1.35}>
          {children}
        </T>
      ) : (
        children
      )}
    </View>
  );
}

export function LiveDot({ size = 8, color }) {
  const t = useTheme();
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color || t.c.fg, opacity: o }} />;
}

// Kinetic Brutalism hazard line (marching diagonal stripes).
export function Hazard({ style }) {
  const t = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: -20, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  if (!t.hazard) return null;
  const w = Dimensions.get('window').width + 40;
  return (
    <View style={[{ height: 4, borderRadius: 2, overflow: 'hidden' }, style]}>
      <Animated.View style={{ transform: [{ translateX: x }] }}>
        <Svg width={w} height={4}>
          {Array.from({ length: Math.ceil(w / 20) }, (_, i) => (
            <Polygon key={i} points={`${i * 20 + 4},0 ${i * 20 + 14},0 ${i * 20 + 10},4 ${i * 20},4`} fill={t.c.fg} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

function Grain() {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(p, { toValue: 3, duration: 600, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [p]);
  const tx = p.interpolate({ inputRange: [0, 1, 1.01, 2, 2.01, 3], outputRange: [0, 0, -12, -12, 8, 8] });
  const ty = p.interpolate({ inputRange: [0, 1, 1.01, 2, 2.01, 3], outputRange: [0, 0, 8, 8, -12, -12] });
  return (
    <Animated.View style={{ position: 'absolute', top: -40, left: -40, right: -40, bottom: -40, opacity: 0.09, transform: [{ translateX: tx }, { translateY: ty }] }}>
      <Image source={require('../../assets/grain.png')} resizeMode="repeat" style={{ width: '100%', height: '100%' }} />
    </Animated.View>
  );
}

function Scanline() {
  const h = Dimensions.get('window').height;
  const y = useRef(new Animated.Value(-90)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(y, { toValue: h * 1.2, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [y, h]);
  return (
    <Animated.View style={{ position: 'absolute', left: 0, right: 0, height: 90, transform: [{ translateY: y }] }}>
      <LinearGradient colors={['transparent', 'rgba(255,255,255,0.03)', 'transparent']} style={{ flex: 1 }} />
    </Animated.View>
  );
}

function RadarGrid() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="useus-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <Line x1="0" y1="0" x2="32" y2="0" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <Line x1="0" y1="0" x2="0" y2="32" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#useus-grid)" />
    </Svg>
  );
}

// Background layers for the current Room DNA / personal aesthetic.
export function BgFx() {
  const t = useTheme();
  if (!t.grain && !t.radar && !t.scanline) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {t.grain && <Grain />}
      {t.radar && <RadarGrid />}
      {t.scanline && <Scanline />}
    </View>
  );
}

// Monochrome yes / no dialog (Android back during a round, leaving a room).
export function ConfirmModal({ visible, title, body, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, testID }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }} testID={testID} accessibilityRole="alert">
        <View style={{ width: '100%', maxWidth: 380, borderRadius: 28, borderWidth: 1, borderColor: '#fff', backgroundColor: '#000', padding: 24 }}>
          <T size={22} w={700} ls={-0.4} color="#fff" center>
            {title}
          </T>
          {body ? (
            <T size={14.5} lh={1.4} color="rgba(255,255,255,0.7)" center style={{ marginTop: 10 }}>
              {body}
            </T>
          ) : null}
          <Button title={confirmLabel} bg="#fff" color="#000" onPress={onConfirm} style={{ marginTop: 24 }} testID="confirm-yes" />
          <Button variant="ghost" title={cancelLabel} color="#fff" onPress={onCancel} style={{ marginTop: 4 }} testID="confirm-no" />
        </View>
      </View>
    </Modal>
  );
}
