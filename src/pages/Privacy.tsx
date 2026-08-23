import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocation, useNavigate } from 'react-router-dom';

const Privacy = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from) {
      navigate(from);
    } else {
      navigate(-1);
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleBack}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[680px] max-h-[90vh] bg-card border-border rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-xl border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handleBack} className="rounded-full -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <DialogTitle className="text-xl font-bold">Privacy Policy</DialogTitle>
            <div className="w-9" />
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-80px)]">
          <div className="px-6 py-6 space-y-6 text-sm leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl font-bold">Muv'it Privacy Policy</h2>
              <p className="text-muted-foreground">Effective Date: 24 August 2026</p>
              <p>
                Muv'it is a dance-first social platform for creating, sharing, discovering and interacting with dance content.
                This Privacy Policy explains how Muv'it collects, uses, stores, shares and protects personal information when
                you use the Muv'it mobile application, website, progressive web app, live features, creator tools and related
                services.
              </p>
              <p>
                By using Muv'it, you acknowledge that your information will be handled as described in this Privacy Policy.
                If you do not agree with this policy, you should not use Muv'it.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">1. Information We Collect</h3>
              <p>We collect information needed to operate Muv'it and provide the features you choose to use.</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Account information such as email address, username, display name, password authentication data and profile details.</li>
                <li>Profile content such as avatar, bio, country, creator details and public profile information.</li>
                <li>User content such as Muv'z, uploaded videos, thumbnails, captions, hashtags, comments, replies, reposts, live messages and battle entries.</li>
                <li>Social activity such as likes, follows, followers, saves, shares, mentions, tags, message requests, direct messages and battle activity.</li>
                <li>Live streaming data such as live title, live status, viewer count, comments, reactions, stream metadata, camera/microphone permission state and session timing.</li>
                <li>Device and app information such as device type, operating system, app version, browser type, IP address, crash logs, performance information and diagnostics.</li>
                <li>Approximate or precise location where you allow location access, for features such as nearby Muva'z and local discovery.</li>
                <li>Notification information such as push tokens, OneSignal subscription IDs, notification preferences, delivery status and unread/read state.</li>
                <li>Payment, coin, gift, monetization and payout-related information where those features are available.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">2. Device Permissions</h3>
              <p>Muv'it asks for permissions only when needed for app features.</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Camera: used to record Muv'z, create profile media and start live streams.</li>
                <li>Microphone: used to record audio with Muv'z and live streams.</li>
                <li>Photos and videos: used so you can choose videos, images, thumbnails and profile pictures from your device.</li>
                <li>Location: used for nearby Muva'z, suggested creators and location-based discovery when you allow it.</li>
                <li>Notifications: used to send alerts for likes, comments, follows, messages, live streams, battles, uploads, earnings and important Muv'it updates.</li>
              </ul>
              <p>You can change permissions in your device settings. Some features may not work if a required permission is denied.</p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">3. How We Use Information</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Create, authenticate and secure your account.</li>
                <li>Show your profile, Muv'z, comments, likes, followers and creator activity.</li>
                <li>Upload, process, store, display and share videos and thumbnails.</li>
                <li>Operate live streaming, live comments, reactions and viewer counts.</li>
                <li>Provide discovery, search, nearby suggestions, trends, challenges and battles.</li>
                <li>Send in-app notifications and real push notifications through OneSignal where enabled.</li>
                <li>Support messaging, message requests and user interactions.</li>
                <li>Improve app speed, reliability, safety, moderation and user experience.</li>
                <li>Detect abuse, spam, fraud, security risks and violations of Muv'it policies.</li>
                <li>Support creator monetization, gifts, stars, coins, payouts and eligibility checks where available.</li>
                <li>Comply with legal obligations and respond to valid legal requests.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">4. Public Content and Visibility</h3>
              <p>
                Muv'it is a social platform. Information you choose to post publicly may be visible to other users, including
                your username, profile picture, public bio, Muv'z, captions, hashtags, comments, likes, battle entries, live
                participation and public creator activity. Other users may interact with, share or repost public content using
                Muv'it features.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">5. Notifications and OneSignal</h3>
              <p>
                Muv'it uses OneSignal and related device notification services to deliver push notifications. We may store
                device subscription IDs, push tokens, notification settings and delivery logs so notifications can be sent to
                the correct user and device.
              </p>
              <p>
                Push notifications may include contextual information, such as who liked, commented, followed, messaged,
                challenged or mentioned you. Where supported by the device platform, notifications may include the actor's
                profile picture or a related content preview. You can control notification categories inside Muv'it and through
                your device settings.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">6. Service Providers</h3>
              <p>
                We use trusted service providers to operate Muv'it, including cloud hosting, database, storage, authentication,
                push notification, analytics, live streaming, payment, moderation and technical infrastructure providers. These
                providers may process information only as needed to provide their services to Muv'it.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">7. Data Sharing</h3>
              <p>We do not sell your personal information. We may share information when necessary to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Provide Muv'it features you use.</li>
                <li>Display public content and social interactions.</li>
                <li>Work with service providers under appropriate safeguards.</li>
                <li>Protect users, Muv'it, our rights and platform safety.</li>
                <li>Comply with law, legal process or valid requests from authorities.</li>
                <li>Investigate fraud, abuse, security issues or policy violations.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">8. Data Security</h3>
              <p>
                We use reasonable technical and organizational safeguards to protect information, including secure transmission,
                access controls and protected backend services. No online service can guarantee complete security, but we work
                to protect Muv'it and respond to security issues responsibly.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">9. Data Retention</h3>
              <p>
                We keep information for as long as needed to provide Muv'it, comply with legal obligations, resolve disputes,
                enforce policies, maintain security and support legitimate business purposes. Public content may remain visible
                until deleted or removed. Some records may be retained where required by law or for safety and integrity reasons.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">10. Your Choices and Rights</h3>
              <p>Depending on your location and available features, you may be able to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Access and update your account profile.</li>
                <li>Delete Muv'z, comments or other content you posted.</li>
                <li>Control privacy and notification settings.</li>
                <li>Block or restrict other users.</li>
                <li>Request account deletion.</li>
                <li>Request access, correction or deletion of personal information where required by law.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">11. Children and Teens</h3>
              <p>
                Muv'it is intended for users who meet the minimum age required in their country. Users under 18 may be subject
                to additional protections, restrictions or parental/guardian requirements. We do not knowingly collect personal
                information from children where prohibited by law.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">12. International Use</h3>
              <p>
                Muv'it may be accessed from different countries. Your information may be processed in countries other than
                where you live. Where applicable, we aim to handle personal information in line with relevant privacy laws,
                including South Africa's Protection of Personal Information Act.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">13. Changes to This Policy</h3>
              <p>
                We may update this Privacy Policy as Muv'it grows. When we make material changes, we may notify users through
                the app, website or another appropriate method. The effective date will show when the policy was last updated.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">14. Contact Us</h3>
              <p>If you have questions about this Privacy Policy or your information, contact Muv'it support.</p>
              <p>
                Email: <a href="mailto:support@muvit.app" className="text-primary hover:underline">support@muvit.app</a>
              </p>
              <p>App: Muv'it</p>
              <p>Country: South Africa</p>
            </section>

            <div className="pt-4 border-t border-border">
              <a href="/terms" className="inline-flex items-center text-primary hover:underline">
                View Terms & Policies
              </a>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default Privacy;
