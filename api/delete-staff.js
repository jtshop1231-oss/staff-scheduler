const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize the Firebase Admin SDK once (Vercel may reuse this same
// function instance across multiple requests, so we guard against
// re-initializing it every time).
if (!getApps().length) {
  if (!process.env.FIREBASE_ADMIN_KEY) {
    console.error('FIREBASE_ADMIN_KEY environment variable is missing.');
  } else {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_KEY))
    });
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!getApps().length) {
    return res.status(500).json({ error: 'Server is missing the FIREBASE_ADMIN_KEY environment variable.' });
  }

  const { staffKey } = req.body || {};
  if (!staffKey) {
    return res.status(400).json({ error: 'Missing staffKey' });
  }

  const db = getFirestore();
  const auth = getAuth();
  const email = `${staffKey}@staffscheduler.local`;

  try {
    // 1. Delete the Firebase Authentication account (login credentials).
    //    This requires the Admin SDK — it cannot be done from the browser.
    //    If no Auth account exists (e.g. it was already removed, or only
    //    the Firestore side ever existed), just continue instead of
    //    treating that as a failure.
    try {
      const userRecord = await auth.getUserByEmail(email);
      await auth.deleteUser(userRecord.uid);
    } catch (authError) {
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    // 2. Delete the three Firestore records tied to this staff member.
    const batch = db.batch();
    batch.delete(db.collection('staffDirectory').doc(staffKey));
    batch.delete(db.collection('preferences').doc(staffKey));
    batch.delete(db.collection('shiftRequests').doc(staffKey));
    await batch.commit();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete staff error:', error);
    return res.status(500).json({ error: error.message });
  }
};
