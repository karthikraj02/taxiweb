import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Banner, Button, Card, Field, Screen, Stars } from '../components/ui';
import { colors, font, space } from '../theme';
import { apiError } from '../api/client';
import { getReviews, sendContactMessage } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import type { Review } from '../types';

export default function ContactScreen() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [reviews, setReviews] = useState<Review[] | null>(null);

  // Reviews can only be written by a customer who completed a ride, so none are invented.
  useEffect(() => {
    getReviews().then((d) => setReviews(d.reviews)).catch(() => setReviews([]));
  }, []);

  const submit = async () => {
    setError(null);
    setSent(false);
    if (name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (message.trim().length < 10) { setError('Please tell us a little more so we can help.'); return; }
    if (!email.trim() && !phone.trim()) { setError('Leave an email or a phone number so we can reply.'); return; }
    setLoading(true);
    try {
      // Success is shown only after the server confirms the message was stored.
      await sendContactMessage({
        name: name.trim(),
        message: message.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      setSent(true);
      setMessage('');
    } catch (err) {
      setError(apiError(err, 'We could not send your message. Please try again or call us.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {sent ? <Banner kind="success">Thanks, your message has been received. We usually reply within one working day.</Banner> : null}

      <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
      <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+919731470096" keyboardType="phone-pad" />
      <Field label="Message" value={message} onChangeText={setMessage} placeholder="Tell us about your trip" multiline maxLength={2000} />
      <Button testID="contact-send" title="Send message" onPress={submit} loading={loading} />

      <Text style={[font.h3, { marginTop: space.xxl, marginBottom: space.md }]}>What customers say</Text>
      {reviews === null ? <Text style={font.small}>Loading reviews...</Text> : null}
      {reviews && reviews.length === 0 ? <Text style={font.small}>No reviews yet. Reviews appear here once customers rate a completed trip.</Text> : null}
      {reviews?.map((r) => (
        <Card key={r.id}>
          <Stars value={r.rating} size={16} />
          <Text style={[font.body, { marginVertical: 6 }]}>{r.comment}</Text>
          <View><Text style={[font.small, { color: colors.muted }]}>{r.author} · verified trip</Text></View>
        </Card>
      ))}
    </Screen>
  );
}
