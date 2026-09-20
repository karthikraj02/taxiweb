import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Banner, Button, Chip, Field, Screen, Segmented } from '../components/ui';
import { colors, font, space } from '../theme';
import { VEHICLES } from '../data/catalog';
import { apiError } from '../api/client';
import { driverRegister, driverRequestOtp } from '../api/endpoints';
import { useDriver } from '../context/DriverContext';
import type { CarType } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Mode = 'login' | 'register';

export default function DriverAuthScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { loginDriver } = useDriver();

  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // login
  const [loginEmail, setLoginEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  // register
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [carType, setCarType] = useState<CarType>('etios');
  const [carNumber, setCarNumber] = useState('');

  const switchMode = (m: Mode) => { setMode(m); setError(null); setInfo(null); setOtpSent(false); setOtp(''); };

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try { await fn(); } catch (err) { setError(apiError(err, fallback)); } finally { setLoading(false); }
  };

  const sendCode = () => {
    if (!loginEmail.trim()) { setError('Enter your email address.'); return; }
    run(async () => { await driverRequestOtp(loginEmail.trim().toLowerCase()); setOtpSent(true); }, 'Could not send the code.');
  };

  const verify = () => {
    if (otp.trim().length !== 6) { setError('Enter the 6-digit code.'); return; }
    run(async () => {
      await loginDriver(loginEmail, otp);
      nav.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'DriverDashboard' }] });
    }, 'That code was not accepted.');
  };

  const submitRegister = () => {
    if (name.trim().length < 2 || !email.trim() || !phone.trim()) { setError('Name, email and phone are required.'); return; }
    run(async () => {
      await driverRegister({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        ...(address.trim() ? { address: address.trim() } : {}),
        carType,
        ...(carNumber.trim() ? { carNumber: carNumber.trim() } : {}),
      });
      setLoginEmail(email.trim().toLowerCase());
      setMode('login');
      setOtpSent(false);
      setInfo('Registered. Now log in with the code we email you. After that an admin reviews your account before you can accept rides.');
    }, 'Registration failed.');
  };

  return (
    <Screen>
      <Text style={[font.h1, { marginBottom: 4 }]}>Driver portal</Text>
      <Text style={[font.body, { marginBottom: space.lg }]}>Udupi Taxi · Driver access</Text>

      <Segmented<Mode> value={mode} onChange={switchMode} options={[{ value: 'login', label: 'Log in' }, { value: 'register', label: 'Register' }]} />
      <View style={{ height: space.lg }} />

      {error ? <Banner kind="error">{error}</Banner> : null}
      {info ? <Banner kind="success">{info}</Banner> : null}

      {mode === 'login' ? (
        <>
          <Field label="Email" value={loginEmail} onChangeText={setLoginEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" editable={!otpSent} testID="driver-email" />
          {!otpSent ? (
            <Button testID="driver-send-code" title="Send code" onPress={sendCode} loading={loading} />
          ) : (
            <>
              {/* The server answers the same whether or not an account exists, so say what to expect. */}
              <Banner kind="info">
                If a driver account exists for {loginEmail.trim()}, a 6-digit code is on its way (check spam too). Nothing is sent to an address that has not registered, so if you are new, register first.
              </Banner>
              <Field label="6-digit code" value={otp} onChangeText={setOtp} placeholder="123456" keyboardType="number-pad" maxLength={6} testID="driver-otp" />
              <View style={{ gap: 10 }}>
                <Button testID="driver-verify" title="Verify and log in" onPress={verify} loading={loading} />
                <Button title="Change email" variant="ghost" onPress={() => { setOtpSent(false); setOtp(''); }} />
                <Button title="Register as a driver" variant="outline" onPress={() => switchMode('register')} />
              </View>
            </>
          )}
        </>
      ) : (
        <>
          <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+919731470096" keyboardType="phone-pad" />
          <Field label="Address (optional)" value={address} onChangeText={setAddress} placeholder="Where you live" />
          <Text style={[font.label, { marginBottom: 8 }]}>Vehicle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.lg }}>
            {VEHICLES.map((v) => <Chip key={v.id} label={v.name} selected={carType === v.id} onPress={() => setCarType(v.id)} />)}
          </ScrollView>
          <Field label="Vehicle registration number" value={carNumber} onChangeText={setCarNumber} placeholder="KA 20 AB 1234" autoCapitalize="characters" />
          <Button testID="driver-register" title="Register as driver" onPress={submitRegister} loading={loading} />
          <Text style={[font.small, { marginTop: space.md, color: colors.muted }]}>
            After registering you verify your email with a code, upload your licence, RC and insurance on the Udupi Taxi website, and an admin approves your account.
          </Text>
        </>
      )}
    </Screen>
  );
}
