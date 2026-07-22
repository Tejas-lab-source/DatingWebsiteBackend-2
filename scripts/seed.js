/**
 * Seeds test users so you can actually swipe/match/chat locally.
 *
 *   node scripts/seed.js          # add 20 users
 *   node scripts/seed.js --fresh  # wipe everything first
 *
 * Every seeded account uses the password: Password123
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const { yearOfStudy } = require('../utils/enrolment');
const Swipe = require('../models/swipe');
const Match = require('../models/match');
const Message = require('../models/message');
const Confession = require('../models/confession');

const FIRST_F = ['Aditi', 'Sneha', 'Riya', 'Ananya', 'Ishita', 'Kavya', 'Meera', 'Nisha', 'Priya', 'Tanvi'];
const FIRST_M = ['Arjun', 'Rohan', 'Kabir', 'Dev', 'Aryan', 'Vivaan', 'Karan', 'Nikhil', 'Sahil', 'Yash'];
const LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Nair', 'Reddy', 'Iyer', 'Bose', 'Malhotra', 'Chopra'];
// Admission years spread across the four batches currently on campus.
const ADMISSION_YEARS = [
  new Date().getFullYear() - 3,
  new Date().getFullYear() - 2,
  new Date().getFullYear() - 1,
  new Date().getFullYear(),
];
const BRANCH = ['101', '102', '103', '104']; // CSE / IT / ECE / BT block in the enrolment no
const BIOS = [
  'Chai over coffee, always. Find me in the library at 2am.',
  'CS major who codes more than sleeps. Talk to me about anything.',
  'Looking for someone to split late-night Maggi with.',
  'Football on weekends, sketching on weekdays.',
  'I take my playlists very seriously.',
  'Trying every cafe within 5km of campus, one at a time.',
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sample = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

async function run() {
  const fresh = process.argv.includes('--fresh');

  await mongoose.connect(process.env.MONGODB_URL);
  console.log('connected');

  if (fresh) {
    await Promise.all([
      User.deleteMany({}), Swipe.deleteMany({}),
      Match.deleteMany({}), Message.deleteMany({}), Confession.deleteMany({}),
    ]);
    console.log('wiped existing data');
  }

  const password = await bcrypt.hash('Password123', 12);
  const docs = [];

  for (let i = 0; i < 20; i++) {
    const gender = i % 2 === 0 ? 'female' : 'male';
    const first = gender === 'female' ? FIRST_F[i % 10] : FIRST_M[i % 10];
    const name = `${first} ${pick(LAST)}`;

    // Real-shaped enrolment numbers: 23103188@mail.jiit.ac.in
    const admissionYear = ADMISSION_YEARS[i % 4];
    const enrolmentNo = `${String(admissionYear).slice(2)}${BRANCH[i % 4]}${String(100 + i).padStart(3, '0')}`;

    docs.push({
      name,
      email: `${enrolmentNo}@mail.jiit.ac.in`,
      enrolmentNo,
      admissionYear,
      password,
      age: 18 + (i % 6),
      gender,
      showMe: gender === 'male' ? ['female'] : ['male'],
      year: yearOfStudy(admissionYear),
      bio: pick(BIOS),
      interests: sample(User.INTERESTS, 3 + (i % 4)),
      // deterministic placeholder avatars, no upload needed
      profile: `https://i.pravatar.cc/600?img=${(i % 70) + 1}`,
      photos: [
        `https://i.pravatar.cc/600?img=${((i + 7) % 70) + 1}`,
        `https://i.pravatar.cc/600?img=${((i + 21) % 70) + 1}`,
      ],
    });
  }

  const created = await User.insertMany(docs, { ordered: false }).catch((e) => {
    // duplicate emails on a re-run are fine
    console.warn('some users already existed');
    return e.insertedDocs || [];
  });
  console.log(`created ${created.length} users`);

  const all = await User.find().select('_id gender').lean();
  const women = all.filter((u) => u.gender === 'female');
  const men = all.filter((u) => u.gender === 'male');

  // Pre-build a few matches so the chat screen isn't empty
  let matches = 0;
  for (let i = 0; i < Math.min(4, women.length, men.length); i++) {
    const [a, b] = [String(women[i]._id), String(men[i]._id)].sort();
    await Swipe.updateOne({ swiper: a, target: b }, { $set: { direction: 'right' } }, { upsert: true });
    await Swipe.updateOne({ swiper: b, target: a }, { $set: { direction: 'right' } }, { upsert: true });
    await Match.updateOne({ user1: a, user2: b }, { $setOnInsert: { user1: a, user2: b } }, { upsert: true });
    await Message.create([
      { senderId: a, receiverId: b, text: 'hey! saw we matched 👋' },
      { senderId: b, receiverId: a, text: 'haha yes! how are your endsems going' },
      { senderId: a, receiverId: b, text: 'do not even ask 😭' },
    ]);
    matches++;
  }
  console.log(`created ${matches} matches with sample chats`);

  await Confession.insertMany(
    BIOS.slice(0, 4).map((_, i) => ({
      author: all[i]._id,
      content: [
        'I have been sitting two rows behind you in DBMS all semester and still have not said hi.',
        'Whoever leaves the AC on in LT3, thank you, you are the real MVP.',
        'I said I was going to the library. I went to the canteen. Every day this week.',
        'To the person who returned my lost ID card to the front desk: you are lovely.',
      ][i],
      isAnonymous: true,
    }))
  );
  console.log('created 4 confessions');

  const sample = await User.find().select('email year').limit(4).lean();
  console.log('\nlog in with any of these (password: Password123):');
  sample.forEach((u) => console.log(`  ${u.email}   ${u.year}`));
  console.log('');

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
