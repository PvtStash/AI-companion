import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8080';

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function App() {
  const [email, setEmail] = useState('you@example.com');
  const [userId, setUserId] = useState(null);
  const [companionId, setCompanionId] = useState(null);
  const [companionName, setCompanionName] = useState('Lyra');
  const [tone, setTone] = useState(20);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const storageKey = useMemo(() => 'companion_bootstrap_v1', []);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setUserId(parsed.userId);
        setCompanionId(parsed.companionId);
        setEmail(parsed.email);
        setCompanionName(parsed.companionName);
        setTone(parsed.tone ?? 20);
      }
    })();
  }, [storageKey]);

  async function bootstrap() {
    setBusy(true);
    try {
      // 1) Create user
      const u = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }).then(r => r.json());
      if (!u.user?.id) throw new Error('User creation failed');
      setUserId(u.user.id);

      // 2) Create companion
      const c = await fetch(`${API_BASE}/api/companions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: u.user.id,
          name: companionName,
          toneLevel: tone,
          persona: { style: "warm", boundaries: { adult: false } }
        })
      }).then(r => r.json());
      if (!c.companion?.id) throw new Error('Companion creation failed');
      setCompanionId(c.companion.id);

      await AsyncStorage.setItem(storageKey, JSON.stringify({
        email,
        userId: u.user.id,
        companionId: c.companion.id,
        companionName,
        tone
      }));

      Alert.alert('Ready', 'User and companion created. Start chatting!');
    } catch (e) {
      Alert.alert('Error', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!draft.trim()) return;
    if (!userId || !companionId) {
      Alert.alert('Setup needed', 'Tap "Create User + Companion" first.');
      return;
    }
    const text = draft.trim();
    setDraft('');
    const userMsg = { id: uid(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, companionId, message: text })
      }).then(res => res.json());

      const reply = r.reply ?? '(no reply)';
      const botMsg = { id: uid(), role: 'assistant', content: reply };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      Alert.alert('Chat error', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const ready = !!userId && !!companionId;

  return (
    <SafeAreaView style={{ flex: 1, padding: 14, backgroundColor: '#fff' }}>
      <StatusBar style="auto" />
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Companion (Starter)</Text>
      <Text style={{ marginBottom: 12, color: '#444' }}>
        This is an AI companion demo. It is not a real person.
      </Text>

      <View style={{ padding: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 12, marginBottom: 12 }}>
        <Text style={{ fontWeight: '600' }}>Setup</Text>
        <Text style={{ marginTop: 8 }}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 10, marginTop: 6 }} />

        <Text style={{ marginTop: 10 }}>Companion name</Text>
        <TextInput value={companionName} onChangeText={setCompanionName}
          style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 10, marginTop: 6 }} />

        <Text style={{ marginTop: 10 }}>Tone level (0–100): {tone}</Text>
        <TextInput value={String(tone)} onChangeText={(t) => setTone(Number(t.replace(/\D/g,'')) || 0)}
          keyboardType="numeric"
          style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 10, marginTop: 6 }} />

        <Pressable
          onPress={bootstrap}
          disabled={busy}
          style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: busy ? '#ddd' : '#111' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
            {ready ? 'Re-create User + Companion' : 'Create User + Companion'}
          </Text>
        </Pressable>

        <Text style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
          API: {API_BASE}
        </Text>
      </View>

      <View style={{ flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 12, overflow: 'hidden' }}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          renderItem={({ item }) => (
            <View style={{
              alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#eee',
              backgroundColor: '#fafafa'
            }}>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                {item.role === 'user' ? 'You' : companionName}
              </Text>
              <Text style={{ fontSize: 15, color: '#111' }}>{item.content}</Text>
            </View>
          )}
          ListFooterComponent={busy ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={ready ? 'Type a message…' : 'Set up first…'}
          style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 12 }}
        />
        <Pressable onPress={send} disabled={busy}
          style={{ paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, backgroundColor: busy ? '#ddd' : '#111' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
