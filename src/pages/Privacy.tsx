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
      <DialogContent className="sm:max-w-[90vw] md:max-w-[600px] max-h-[90vh] bg-card border-border rounded-3xl p-0 overflow-hidden">
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
          <div className="px-6 py-6 space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Privacy Policy for Muv'it</h2>
              <p className="text-muted-foreground text-sm">Last updated: January 16, 2026</p>
              <p className="leading-relaxed text-sm">
                Muv'it ("we", "our", or "us") respects your privacy and is committed to protecting it. This Privacy Policy explains how we collect, use, store, and protect your information when you use the Muv'it mobile application.
              </p>
              <p className="leading-relaxed text-sm">
                By using Muv'it, you agree to the practices described in this policy.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">1. Information We Collect</h3>
              <p className="leading-relaxed text-foreground/90 text-sm">
                We collect the following types of information to provide and improve our services:
              </p>
              
              <div className="space-y-3 ml-4">
                <div>
                  <h4 className="font-medium text-sm">a) Personal Information</h4>
                  <ul className="list-disc list-inside space-y-1 text-foreground/90 text-sm mt-1">
                    <li>Email address</li>
                    <li>Username</li>
                    <li>Profile information you choose to provide</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm">b) User Content</h4>
                  <ul className="list-disc list-inside space-y-1 text-foreground/90 text-sm mt-1">
                    <li>Videos you upload</li>
                    <li>Captions, comments, and interactions</li>
                    <li>Profile images</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm">c) Usage Information</h4>
                  <ul className="list-disc list-inside space-y-1 text-foreground/90 text-sm mt-1">
                    <li>App activity (likes, views, follows)</li>
                    <li>Device type and app version</li>
                    <li>Crash and performance data</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">2. How We Use Your Information</h3>
              <p className="leading-relaxed text-foreground/90 text-sm">We use your information to:</p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 text-sm">
                <li>Create and manage your account</li>
                <li>Allow you to upload and share dance videos</li>
                <li>Enable features such as battles, challenges, duets, and cyphers</li>
                <li>Improve app performance and user experience</li>
                <li>Ensure platform safety and prevent abuse</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">3. Data Sharing</h3>
              <p className="leading-relaxed text-foreground/90 text-sm">
                We do not sell, rent, or trade your personal data to third parties.
              </p>
              <p className="leading-relaxed text-foreground/90 text-sm">We may share limited data only:</p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 text-sm">
                <li>To comply with legal obligations</li>
                <li>To protect users, safety, or platform integrity</li>
                <li>With trusted service providers who help operate the app (under strict confidentiality)</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">4. Children's Privacy</h3>
              <p className="leading-relaxed text-foreground/90 text-sm">
                Muv'it is not intended for children under the age of 13.
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 text-sm">
                <li>Users must be 13 years or older</li>
                <li>We do not knowingly collect data from children under 13</li>
                <li>If such data is discovered, it will be deleted immediately</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">5. Data Security</h3>
              <p className="leading-relaxed text-foreground/90 text-sm">
                We take reasonable measures to protect your data, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 text-sm">
                <li>Secure servers</li>
                <li>Encrypted data transmission</li>
                <li>Limited access to personal information</li>
              </ul>
              <p className="leading-relaxed text-foreground/90 text-sm">
                However, no system is 100% secure, and we cannot guarantee absolute security.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">6. User Controls & Data Deletion</h3>
              <p className="leading-relaxed text-foreground/90 text-sm">You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 text-sm">
                <li>Edit your profile information</li>
                <li>Delete your content</li>
                <li>Request account deletion</li>
              </ul>
              <p className="leading-relaxed text-foreground/90 text-sm">
                Account deletion will permanently remove your personal data, except where retention is required by law.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">7. Third-Party Services</h3>
              <p className="leading-relaxed text-foreground/90 text-sm">
                Muv'it may use third-party services (such as analytics or cloud storage) that have their own privacy policies. We are not responsible for their practices but ensure they meet reasonable privacy standards.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">8. Changes to This Policy</h3>
              <p className="leading-relaxed text-foreground/90 text-sm">
                We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">9. Contact Us</h3>
              <p className="leading-relaxed text-foreground/90 text-sm">
                If you have any questions or concerns about this Privacy Policy, contact us at:
              </p>
              <div className="space-y-2 text-foreground/90 text-sm">
                <p>
                  📧 Email: <a href="mailto:support@muvit.app" className="text-primary hover:underline">support@muvit.app</a>
                </p>
                <p>
                  📧 Email: <a href="mailto:Info@semogroup.com" className="text-primary hover:underline">Info@semogroup.com</a>
                </p>
                <p>🌐 App Name: Muv'it</p>
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <p className="text-sm text-muted-foreground">
                Related policies:
              </p>
              <a 
                href="/terms" 
                className="inline-flex items-center text-primary hover:underline text-sm"
              >
                View Terms & Policies →
              </a>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default Privacy;
