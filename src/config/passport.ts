import passport from "passport";
import {
  Strategy as GoogleStrategy,
  type Profile,
} from "passport-google-oauth20";
import { User } from "../models/user.models.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: `${process.env.BASE_URL}/api/v1/auth/google/callback`,
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done
    ) => {
      try {
        if (!profile.emails || profile.emails.length === 0) {
          return done(new Error("No email from Google"), undefined);
        }

        const email = profile.emails?.[0].value;
        if (!email) return done(new Error("No email"), undefined);

        let user = await User.findOne({ email });

        if (!user) {
          // 🆕 new user via Google
          let username = email.split("@")[0]

          const isUsernameExists = await User.findOne({ username });

          if (isUsernameExists) {
            username = username + Math.floor(Math.random() * 1000000);
          }

          user = await User.create({
            email,
            username,
            name: profile.displayName,
            profilepic: profile.photos?.[0].value,
            authProviders: {
              googleId: profile.id,
            },
          });
        } else {
          // 🔗 LINK GOOGLE if not linked
          if (!user.authProviders?.googleId) {
            user.authProviders = {
              ...user.authProviders,
              googleId: profile.id,
            };

            if (!user.profilepic) user.profilepic = profile.photos?.[0].value;

            await user.save();
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

export default passport;
