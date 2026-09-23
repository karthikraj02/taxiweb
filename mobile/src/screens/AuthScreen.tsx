import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Banner, Button, Field, Screen, Segmented } from '../components/ui';
import { colors, font, space } from '../theme';
import { apiError } from '../api/client';
import { forgotPassword, requestOtp, resetPassword } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';

type Mode = 'login' | 'register' | 'otp' | 'forgot';

/** Same rules the server enforces (server/validators/schemas.js), checked up front for faster feedback. */
function passwordProblem(p: string): string | null {
  if (p.length < 10) return 'Password must be at least 10 characters.';
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) return 'Password needs an uppercase letter, a lowercase letter and a number.';
  return null;
}

export default function AuthScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { login, register, loginWithOtp } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  // Forgot-password sub-flow.
  const [resetEmail, setResetEmail] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const switchMode = (m: Mode) => { setMode(m); setError(null); setInfo(null); setOtpSent(false); setOtp(''); };

  const openForgotPassword = () => {
    setResetEmail(email.trim());
    setResetCodeSent(false);
    setResetCode('');
    setNewPassword('');
    setError(null);
    setInfo(null);
    setMode('forgot');
  };

  const done = () => nav.goBack();

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setError(apiError(err, fallback));
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = () => {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    run(async () => { await login(email, password); done(); }, 'Login failed.');
  };

  const submitRegister = () => {
    if (name.trim().length < 2) { setError('Enter your name.'); return; }
    if (!email.trim() && !phone.trim()) { setError('Enter an email address or a phone number.'); return; }
    const problem = passwordProblem(password);
    if (problem) { setError(problem); return; }
    run(
      async () => {
        await register({
          name: name.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          password,
        });
        done();
      },
      'Registration failed.'
    );
  };

  const sendOtp = () => {
    if (!phone.trim()) { setError('Enter your phone number with country code, e.g. +919731470096.'); return; }
    run(async () => { await requestOtp(phone.trim()); setOtpSent(true); setInfo('If that number is registered, a code has been sent.'); }, 'Could not send the code.');
  };

  const verifyOtp = () => {
    if (otp.trim().length !== 6) { setError('Enter the 6-digit code.'); return; }
    run(async () => { await loginWithOtp(phone, otp); done(); }, 'That code was not accepted.');
  };

  const sendResetCode = () => {
    if (!resetEmail.trim()) { setError('Enter your email address.'); return; }
    run(async () => {
      await forgotPassword(resetEmail.trim());
      setResetCodeSent(true);
      setInfo('If that email is registered, a reset code has been sent. Check spam too.');
    }, 'Could not send the reset code.');
  };

  const submitReset = () => {
    if (resetCode.trim().length !== 6) { setError('Enter the 6-digit code.'); return; }
    const problem = passwordProblem(newPassword);
    if (problem) { setError(problem); return; }
    run(async () => {
      await resetPassword(resetEmail.trim(), resetCode.trim(), newPassword);
      // The server revokes every existing session on reset, so the user signs
      // in again with the new password rather than being silently logged in.
      setEmail(resetEmail.trim());
      setPassword('');
      setMode('login');
      setInfo('Password reset. Log in with your new password.');
    }, 'That code was not accepted.');
  };

  return (
    <Screen>
      <Text style={[font.h1, { marginBottom: 4 }]}>Welcome to Udupi Taxi</Text>
      <Text style={[font.body, { marginBottom: space.lg }]}>
        {mode === 'forgot' ? 'Reset your password.' : 'Log in or create an account to book your ride.'}
      </Text>

      {mode !== 'forgot' ? (
        <>
          <Segmented<Mode>
            value={mode}
            onChange={switchMode}
            options={[{ value: 'login', label: 'Log in' }, { value: 'register', label: 'Register' }, { value: 'otp', label: 'OTP' }]}
          />
          <View style={{ height: space.lg }} />
        </>
      ) : null}

      {error ? <Banner kind="error">{error}</Banner> : null}
      {info ? <Banner kind="info">{info}</Banner> : null}

      {mode === 'login' ? (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="login-email" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry autoComplete="password" testID="login-password" />
          <Pressable onPress={openForgotPassword} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: space.lg }}>
            <Text style={{ color: colors.brandDark, fontWeight: '600', fontSize: 13 }}>Forgot password?</Text>
          </Pressable>
          <Button testID="login-submit" title="Log in" onPress={submitLogin} loading={loading} />
        </>
      ) : null}

      {mode === 'register' ? (
        <>
          <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
          <Field label="Phone (optional if you gave an email)" value={phone} onChangeText={setPhone} placeholder="+919731470096" keyboardType="phone-pad" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 10 characters" secureTextEntry />
          <Text style={[font.small, { marginTop: -8, marginBottom: space.lg }]}>Use upper and lower case letters and a number.</Text>
          <Button testID="register-submit" title="Create account" onPress={submitRegister} loading={loading} />
        </>
      ) : null}

      {mode === 'otp' ? (
        <>
          <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="+919731470096" keyboardType="phone-pad" editable={!otpSent} />
          {!otpSent ? (
            <Button title="Send code" onPress={sendOtp} loading={loading} />
          ) : (
            <>
              <Field label="6-digit code" value={otp} onChangeText={setOtp} placeholder="123456" keyboardType="number-pad" maxLength={6} />
              <View style={{ gap: 10 }}>
                <Button title="Verify and log in" onPress={verifyOtp} loading={loading} />
                <Button title="Change number" variant="ghost" onPress={() => { setOtpSent(false); setOtp(''); setInfo(null); }} />
              </View>
            </>
          )}
          <Text style={[font.small, { marginTop: space.lg, color: colors.muted }]}>Codes are sent by SMS and expire after 5 minutes.</Text>
        </>
      ) : null}

      {mode === 'forgot' ? (
        <>
          <Field
            label="Email"
            value={resetEmail}
            onChangeText={setResetEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!resetCodeSent}
            testID="forgot-email"
          />
          {!resetCodeSent ? (
            <Button testID="forgot-send" title="Send reset code" onPress={sendResetCode} loading={loading} />
          ) : (
            <>
              <Field label="6-digit code" value={resetCode} onChangeText={setResetCode} placeholder="123456" keyboardType="number-pad" maxLength={6} testID="forgot-code" />
              <Field label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="At least 10 characters" secureTextEntry testID="forgot-password" />
              <Text style={[font.small, { marginTop: -8, marginBottom: space.lg }]}>Use upper and lower case letters and a number.</Text>
              <View style={{ gap: 10 }}>
                <Button testID="forgot-submit" title="Reset password" onPress={submitReset} loading={loading} />
                <Button title="Change email" variant="ghost" onPress={() => { setResetCodeSent(false); setResetCode(''); setInfo(null); }} />
              </View>
            </>
          )}
          <Button title="Back to log in" variant="ghost" style={{ marginTop: space.md }} onPress={() => switchMode('login')} />
        </>
      ) : null}
    </Screen>
  );
}
