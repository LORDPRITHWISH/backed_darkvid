import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { User } from "../models/user.models.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: "/api/v1/auth/google/callback",
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done
    ) => {
      try {
        const email = profile.emails?.[0].value;

        if (!email) return done(new Error("No email found"), undefined);

        let user = await User.findOne({ email });

        if (!user) {
          user = await User.create({
            email,
            provider: "google",
            providerId: profile.id,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

export default passport;
