/** Subject-specific, original starter lessons for the 26 fictional Masana.
 * Released in a Room as normal, public educational material. Staff/editor
 * additions always retain their own immutable lesson IDs and publication state.
 * This isn't a credentials/qualification registry or medical/legal advice. */
export const MASANA_INTRO_LESSONS:Readonly<Record<string,readonly [string,string]>> =
 Object.freeze({
 "gwani": [
  "Masanawa provides a Chats tab for talking to AI Masana, Rooms for group learning, Calls for voice conversations, Status for updates, and Wallet for qualified services. Start by choosing a named agent in Chats. A Room is for learning together; private chat is one-to-one. Payment screens and voice sessions have their own confirmations.",
  "Open the Masana directory and identify the difference between private Chat and a Room question. Ask Gwani how to find a language tutor, then look for that tutor's Room. Never share a password or private payment code in a chat."
 ],
 "gwana": [
  "A Masana is an AI character, not a human employee. Text conversations can answer questions and teach concepts. Voice calls require a working microphone, provider connectivity, and any clearly shown voice admission terms. Status updates and Rooms are separate from private conversations.",
  "Choose one university subject that interests you, find its teacher in the directory and read the free Room preview. If a feature fails, note the exact message and ask Gwana for help rather than repeating a payment."
 ],
 "amina": [
  "Anatomy studies the structures of the human body, while physiology explains how those structures work. For example, the heart has four chambers and valves (anatomy); cardiac contractions move blood through two connected circulations (physiology). Pathology studies processes that disturb normal function. These distinctions help organize a medical-school topic without confusing educational concepts with a patient diagnosis.",
  "Sketch a pathway from body tissues to the right heart, lungs, left heart and back to tissues. Label where blood exchanges gases. Explain why a symptom alone cannot establish a diagnosis and when a qualified clinician is needed."
 ],
 "fatima": [
  "Nursing care begins with structured observation and safe communication. A basic assessment distinguishes the patient's reported experiences (subjective data) from observable findings (objective data). Documentation should be accurate, timed and respectful of privacy. Nursing interventions follow established clinical protocols and local professional supervision.",
  "Write a fictional example showing three subjective observations and three objective findings. Explain which observations need urgent clinical escalation, rather than independently prescribing treatment."
 ],
 "salim": [
  "Pharmaceutical calculations require consistent units. Concentration describes the amount of a substance per unit volume or mass; for example, 5 mg/mL means each millilitre contains five milligrams. Dimensional analysis cancels units: a theoretical 10 mg amount at 5 mg/mL corresponds to 2 mL. Real medication use must follow an authorized prescription and qualified supervision.",
  "For mathematics practice only, convert 250 micrograms into milligrams, then calculate the number of millilitres containing 15 mg at 3 mg/mL. State the units at every step; do not use classroom arithmetic as a patient-specific dosing instruction."
 ],
 "zainab": [
  "A constitution sets the foundation of a state's government and allocation of powers. Legal study also considers statutes, judicial decisions and applicable subsidiary rules. In Nigeria, legal analysis requires identifying the relevant jurisdiction, source of authority and facts before asserting what a rule means. Classroom discussion is not a substitute for advice by an admitted lawyer.",
  "Write an issue–rule–application–conclusion outline for a fictional dispute about a local authority's power. Identify which question requires reading an actual law or judgment before any conclusion can be reliable."
 ],
 "sadiq": [
  "An algorithm is a finite, precise procedure for a task. Data structures organize information to support operations such as lookup, insertion or sorting. An array allows direct indexed access; a hash table normally supports efficient key lookup when implemented well. Complexity analysis describes how resource use grows with input size rather than merely timing one computer.",
  "Write pseudocode to find the maximum of five numbers. Explain the running time for n inputs and why an algorithm must also handle an empty list explicitly."
 ],
 "musa": [
  "Voltage is an electric potential difference; current is the flow of charge; resistance opposes current. For an ideal ohmic resistor, Ohm's law states V = IR. Power in a DC resistor can be expressed as P = VI. Real installations also require safety, ratings, insulation and proper professional supervision.",
  "A theoretical 6 Ω resistor is connected across an ideal 12 V supply. Calculate current and dissipated power with units. Explain why the resistor's power rating matters."
 ],
 "bello": [
  "Civil engineering studies how structures safely carry loads into the ground. Permanent loads include self-weight; variable loads include occupants and movable objects. Beams, columns and foundations transfer forces through different mechanisms. Engineers evaluate stability, strength, serviceability and relevant building codes together.",
  "Draw a simply supported beam carrying one central point load. Describe the direction of the support reactions and why checking strength alone would not establish a safe building design."
 ],
 "umar": [
  "Newton's second law relates net force, mass and acceleration in a chosen reference frame: F = ma. Thermodynamics tracks energy and its transformations, distinguishing heat transfer from work. Mechanical systems require both calculations and assumptions about friction, materials, dimensions and operating conditions.",
  "A 4 kg ideal cart accelerates at 3 m/s². Find the net force, then explain how friction changes the applied force needed. State the limitations of the ideal model."
 ],
 "safiya": [
  "Architectural design balances human needs, circulation, daylight, ventilation, structure and context. Early diagrams can separate quiet spaces, public spaces and service areas. In a hot climate, orientation, shading and cross-ventilation influence thermal comfort, although specific designs require local weather and engineering evidence.",
  "Sketch a small community classroom with an entrance, accessible circulation, daylight and shaded openings. Describe three design choices that improve comfort without claiming the drawing is an approved building plan."
 ],
 "ruqayya": [
  "A function maps each allowed input to exactly one output. In f(x) = 2x + 3, the output rises by two for each one-unit increase in x. The derivative measures an instantaneous rate of change; the derivative of this linear function is 2 everywhere. Domain, units and assumptions matter when applying mathematics.",
  "Evaluate f(-1), f(0) and f(4) for f(x)=2x+3. Sketch three points and explain why the slope is constant. Ask the tutor for a more challenging calculus example."
 ],
 "idris": [
  "The basic equation is Assets = Liabilities + Equity. An owner investing cash increases both assets and equity; borrowing cash increases assets and liabilities. Double-entry bookkeeping records the corresponding effects so entries remain balanced. Financial statements summarize positions and performance but do not replace source documentation.",
  "For a fictional business, record an owner investing ₦50,000 and receiving a ₦20,000 loan. Calculate total assets, liabilities and equity immediately afterward and check the equation."
 ],
 "maryam": [
  "Demand describes quantities buyers are willing and able to purchase at different prices; supply describes quantities sellers will offer, holding other factors constant. Market equilibrium is where planned demand equals planned supply. A shift in demand differs from movement along a demand curve caused by price changing.",
  "Explain what might happen to demand for umbrellas during rainy weather. Draw before-and-after demand curves, label the assumptions, and distinguish a demand shift from a price-only movement."
 ],
 "kabir": [
  "A value proposition explains whom a business serves, the problem it addresses and the benefit delivered. Revenue comes from customer payments, while profit requires accounting for expenses. Testing demand with interviews and small experiments is often more useful than assuming a product will sell.",
  "Describe a small service business using four lines: target customer, specific problem, solution, and way to test demand without spending much money. List two costs that could reduce profit."
 ],
 "hauwa": [
  "Journalism distinguishes verified facts, attributed claims, informed analysis and opinion. Strong reporting confirms basic who, what, when, where and why questions, checks independent sources and corrects errors. Headlines should reflect evidence rather than manufacture certainty. Journalism also demands care with privacy and harm.",
  "Draft a three-sentence news brief about a fictional university event. Label what requires independent verification before publication and rewrite one sensational headline as a precise factual one."
 ],
 "yusuf": [
  "Plants need light, water, air, nutrients and suitable temperatures. Soil texture influences water retention and drainage; organic matter can improve soil structure and nutrient cycling. Effective crop planning considers local rainfall, crop variety and pests rather than relying on one universal fertilizer plan.",
  "Compare a sandy and a clay-rich soil after a heavy rain. Predict which drains faster and describe two local observations a farmer should collect before choosing an irrigation approach."
 ],
 "haruna": [
  "A useful learning objective states what learners should be able to demonstrate. Formative assessment checks progress during teaching, while summative assessment evaluates learning after a period of instruction. Feedback is most useful when specific, actionable and aligned to the learning objective.",
  "Write one objective for teaching fractions to a beginner and create one short formative question. Explain what feedback you would provide for a common mistake."
 ],
 "bilkisu": [
  "Enzymes catalyse reactions by lowering activation energy without being consumed in the overall reaction. Their activity depends on conditions such as temperature, pH and substrate availability. Metabolic pathways connect reactions to transform nutrients and sustain living cells.",
  "Describe how an enzyme's activity may change outside its preferred pH range. Distinguish an enzyme, a substrate and a product using a simple fictional reaction."
 ],
 "nura": [
  "Displacement includes direction, whereas distance measures the total path length. Average velocity is displacement divided by elapsed time; average speed uses distance instead. Measurement requires units, uncertainty and a clear choice of coordinate direction.",
  "A student walks 3 m east then 3 m west in 6 seconds. Calculate distance, displacement, average speed and average velocity, each with appropriate units."
 ],
 "aisha": [
  "An element contains one kind of atom defined by its proton number; a compound contains atoms of more than one element chemically bonded in fixed relationships. A chemical equation conserves atoms and charge. Laboratory observations, safety rules and units all affect how a reaction is understood.",
  "Balance H₂ + O₂ → H₂O. Count hydrogen and oxygen atoms on both sides, then explain why balancing changes coefficients rather than the chemical formula."
 ],
 "abdulrahman": [
  "Political science examines how authority is organized, exercised and contested. Institutions such as legislatures, executives and courts have roles set by constitutional or legal rules; actual powers vary by jurisdiction. Accountability can involve elections, oversight, judicial review and transparent public records.",
  "Compare two hypothetical ways citizens could challenge a local policy decision. Distinguish lawful institutional procedures from simply disagreeing with an official's opinion."
 ],
 "layla": [
  "Start with السَّلَامُ عَلَيْكُمْ (as-salāmu ʿalaykum), meaning 'Peace be upon you'. A common reply is وَعَلَيْكُمُ السَّلَامُ (wa-ʿalaykumu s-salām). Arabic is written from right to left, and vowel marks can help learners identify pronunciation. Practise listening carefully to long and short vowels.",
  "Read this exchange aloud: السَّلَامُ عَلَيْكُمْ / وَعَلَيْكُمُ السَّلَامُ. Then say 'What is your name?' as مَا اسْمُكَ؟ (mā ismuka?) to a male speaker, and ask the tutor to correct pronunciation."
 ],
 "grace": [
  "A complete English sentence usually contains a subject and a finite verb: 'The student studies.' In statements, normal word order is subject–verb–object when an object is needed. Pronunciation practice focuses on intelligibility and stress, not forcing every speaker to imitate one accent.",
  "Correct these sentences: 'She go to class' and 'Yesterday I am late'. Read your improved versions aloud and ask the tutor to identify stress and tense choices."
 ],
 "asha": [
  "नमस्ते (namaste) is a common greeting. In Hindi, आप (aap) is a respectful 'you'; आपका नाम क्या है? (aapka naam kya hai?) means 'What is your name?' Hindi is written in Devanagari and has sounds that require careful tongue placement. Practise listening before memorizing transliterations.",
  "Say 'नमस्ते, मेरा नाम ___ है।' (Hello, my name is ___). Compare the sounds represented by त and ट and ask the tutor to guide you through a slow spoken exchange."
 ],
 "mei": [
  "Mandarin uses tones to distinguish meanings. Standard Mandarin has four main lexical tones and a neutral tone. Pinyin writes pronunciation with Roman letters and marks tones: mā, má, mǎ and mà show different tones on the syllable 'ma'. Characters are written with strokes in consistent patterns.",
  "Practise 你好 (nǐ hǎo, hello) and 谢谢 (xièxie, thank you). Speak each slowly, then ask the tutor to compare the falling-rising third tone with the falling fourth tone."
 ]
});
export function initialRoomLessons(key:string):readonly {id:string;body:string}[]{
 const contents=MASANA_INTRO_LESSONS[key];
 if(!contents)throw new Error("masana_room_lessons_missing");
 return Object.freeze(contents.map((body,index)=>Object.freeze({
   id:"room-lesson_masana_"+key+"_"+(index===0?"intro":"practice")+"_v1",
   body:(index===0?"Lesson 1 · ":"Practice 1 · ")+
       (index===0?"Understand the basics":"Try it yourself")+"\n\n"+body,
 })));
}
