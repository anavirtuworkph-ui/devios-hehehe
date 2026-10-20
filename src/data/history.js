// Real historical facts for the Historical Archive sub-room (one is guaranteed in every
// non-boss sub-level of the five main eras; the satirical 202X era has none). Facts are real history; only the game's boss fights are fiction.
// quiz: { q, choices, answer (index), explain }
export const HISTORY = {
  precolonial: {
    curator: 'Babaylan Archivist',
    facts: [
      { title: 'The Battle of Mactan', text: 'On 27 April 1521, Lapu-Lapu and the warriors of Mactan defeated Ferdinand Magellan’s landing party. Magellan was killed in the battle.' },
      { title: 'Laguna Copperplate Inscription', text: 'Dated to 900 AD (Saka year 822), it is the oldest known written document found in the Philippines. It was discovered near Lumban, Laguna, in 1989 and records the clearing of a debt.' },
      { title: 'Baybayin', text: 'Baybayin is a pre-colonial script used to write Tagalog and other languages. Each character stands for a consonant with the vowel "a"; marks above or below change the vowel.' },
      { title: 'Barangay and balangay', text: 'The word barangay comes from the balangay, a plank-built boat. Balangay boats excavated in Butuan, Agusan del Norte, are among the oldest watercraft found in Southeast Asia.' },
      { title: 'Rajah Humabon', text: 'Rajah Humabon, ruler of Cebu, allied with Magellan in April 1521 and was baptized, while Lapu-Lapu of nearby Mactan refused to submit.' },
      { title: 'Arrival in 1521', text: 'Magellan’s fleet reached the archipelago in March 1521, landing at Homonhon island before sailing on to Limasawa and Cebu.' },
    ],
    quiz: [
      { q: 'When was the Battle of Mactan fought?', choices: ['27 April 1521', '12 June 1898', '16 March 1565', '4 July 1946'], answer: 0, explain: 'Lapu-Lapu’s forces won at Mactan on 27 April 1521.' },
      { q: 'What is the oldest known written document found in the Philippines?', choices: ['Noli Me Tangere', 'The Laguna Copperplate Inscription', 'The Treaty of Paris', 'The Code of Kalantiaw'], answer: 1, explain: 'The Laguna Copperplate Inscription is dated 900 AD.' },
      { q: 'The word "barangay" comes from which kind of boat?', choices: ['Galleon', 'Balangay', 'Junk', 'Vinta'], answer: 1, explain: 'Barangay comes from the balangay, a plank-built boat.' },
    ],
  },
  spanish: {
    curator: 'Librarian of the Ilustrados',
    facts: [
      { title: 'The KKK', text: 'The Katipunan’s full name is Kataastaasan, Kagalanggalangang Katipunan ng mga Anak ng Bayan ("Supreme and Most Venerable Association of the Children of the Nation"). It was founded in Tondo, Manila, on 7 July 1892, with Andrés Bonifacio among its founders.' },
      { title: 'José Rizal', text: 'Rizal was born on 19 June 1861 in Calamba, Laguna, and executed by firing squad at Bagumbayan (now Luneta) on 30 December 1896.' },
      { title: 'Rizal’s novels', text: 'Noli Me Tangere was published in Berlin in 1887. Its sequel, El Filibusterismo, was published in Ghent, Belgium, in 1891.' },
      { title: 'GomBurZa', text: 'Fathers Mariano Gomez, José Burgos and Jacinto Zamora were executed on 17 February 1872. Their deaths deeply influenced Rizal, who dedicated El Filibusterismo to them.' },
      { title: 'The Cry of Pugad Lawin', text: 'In August 1896 Katipuneros led by Bonifacio tore up their cedulas (community tax certificates), signalling the start of the revolution against Spain.' },
      { title: 'The galleon trade', text: 'From 1565 to 1815, Manila galleons sailed between Manila and Acapulco, Mexico, carrying Asian goods across the Pacific.' },
      { title: 'Independence declared', text: 'Emilio Aguinaldo proclaimed Philippine independence from Spain in Kawit, Cavite, on 12 June 1898.' },
    ],
    quiz: [
      { q: 'What does "KKK" stand for in Philippine history?', choices: ['Kalayaan, Katarungan, Kapayapaan', 'Kataastaasan, Kagalanggalangang Katipunan ng mga Anak ng Bayan', 'Kapisanan ng mga Katutubong Kawal', 'Katipunan ng Kabataang Kastila'], answer: 1, explain: 'KKK = Kataastaasan, Kagalanggalangang Katipunan ng mga Anak ng Bayan, founded 7 July 1892.' },
      { q: 'Where was Noli Me Tangere first published?', choices: ['Manila', 'Madrid', 'Berlin', 'Hong Kong'], answer: 2, explain: 'Noli Me Tangere was published in Berlin in 1887.' },
      { q: 'When was José Rizal executed?', choices: ['30 December 1896', '19 June 1861', '12 June 1898', '17 February 1872'], answer: 0, explain: 'Rizal was executed at Bagumbayan on 30 December 1896.' },
      { q: 'Where did Aguinaldo proclaim independence on 12 June 1898?', choices: ['Malolos, Bulacan', 'Kawit, Cavite', 'Tondo, Manila', 'Biak-na-Bato'], answer: 1, explain: 'Independence was proclaimed in Kawit, Cavite.' },
    ],
  },
  american: {
    curator: 'Thomasite Schoolteacher',
    facts: [
      { title: 'The Treaty of Paris', text: 'Signed on 10 December 1898, the treaty ended the Spanish-American War. Spain ceded the Philippines to the United States for US$20 million.' },
      { title: 'The Philippine-American War', text: 'Fighting between Filipino and American forces broke out on 4 February 1899. Emilio Aguinaldo was captured in Palanan, Isabela, on 23 March 1901.' },
      { title: 'The Thomasites', text: 'In August 1901 about 500 American teachers arrived aboard the USAT Thomas to set up a public school system. They became known as the Thomasites.' },
      { title: 'The Balangiga bells', text: 'After the Balangiga encounter in Samar on 28 September 1901, US troops took the church bells as war trophies. They were returned to the Philippines in December 2018.' },
      { title: 'The Commonwealth', text: 'The Tydings–McDuffie Act of 1934 set a ten-year path to independence. The Commonwealth of the Philippines was inaugurated on 15 November 1935, with Manuel L. Quezon as president.' },
      { title: 'The Conant peso', text: 'The Philippine Coinage Act of 1903 created a new silver peso, nicknamed after economist Charles Conant, who designed the currency reform.' },
    ],
    quiz: [
      { q: 'When was the Treaty of Paris (ceding the Philippines to the US) signed?', choices: ['4 July 1946', '10 December 1898', '15 November 1935', '4 February 1899'], answer: 1, explain: 'The Treaty of Paris was signed on 10 December 1898.' },
      { q: 'Who were the Thomasites?', choices: ['American soldiers', 'American teachers', 'Spanish friars', 'Filipino revolutionaries'], answer: 1, explain: 'About 500 American teachers arrived aboard the USAT Thomas in 1901.' },
      { q: 'Who was the first president of the Philippine Commonwealth?', choices: ['Emilio Aguinaldo', 'Sergio Osmeña', 'Manuel L. Quezon', 'José P. Laurel'], answer: 2, explain: 'Manuel L. Quezon led the Commonwealth from 15 November 1935.' },
    ],
  },
  japanese: {
    curator: 'Guerrilla Radio Operator',
    facts: [
      { title: 'The invasion', text: 'Japan attacked the Philippines on 8 December 1941, only hours after the attack on Pearl Harbor (7 December across the date line).' },
      { title: 'The Fall of Bataan', text: 'Filipino and American defenders on Bataan surrendered on 9 April 1942, now remembered as Araw ng Kagitingan (Day of Valor). The Bataan Death March followed.' },
      { title: 'Corregidor', text: 'The island fortress of Corregidor fell on 6 May 1942, ending organized resistance by the main Filipino-American forces.' },
      { title: 'The Second Republic', text: 'A Japanese-sponsored republic was declared on 14 October 1943, with José P. Laurel as president.' },
      { title: 'The Hukbalahap', text: 'The Hukbong Bayan Laban sa Hapon (Hukbalahap) guerrilla army was founded on 29 March 1942 in Central Luzon.' },
      { title: 'The return', text: 'Allied forces under General Douglas MacArthur landed on Leyte on 20 October 1944. The Battle of Leyte Gulf that month is often called the largest naval battle in history.' },
      { title: 'The Battle of Manila', text: 'Fighting in Manila from February to March 1945 devastated the city. An estimated 100,000 civilians were killed.' },
    ],
    quiz: [
      { q: 'What is commemorated on Araw ng Kagitingan (9 April)?', choices: ['The Leyte landing', 'The Fall of Bataan', 'The Battle of Manila', 'Independence Day'], answer: 1, explain: 'Bataan fell on 9 April 1942; the day honors its defenders.' },
      { q: 'What does "Hukbalahap" stand for?', choices: ['Hukbong Bayan Laban sa Hapon', 'Hukbo ng Bayan para sa Pilipinas', 'Hukbong Lakas ng Hapon', 'Hukbo ng mga Bayani at Pantas'], answer: 0, explain: 'Hukbalahap = Hukbong Bayan Laban sa Hapon, founded 29 March 1942.' },
      { q: 'When did MacArthur’s forces land on Leyte?', choices: ['8 December 1941', '6 May 1942', '20 October 1944', '4 July 1946'], answer: 2, explain: 'The Leyte landing took place on 20 October 1944.' },
    ],
  },
  marcos: {
    curator: 'Radio Veritas Volunteer',
    facts: [
      { title: 'Martial law', text: 'Ferdinand Marcos placed the country under martial law through Proclamation No. 1081, dated 21 September 1972 and announced on 23 September 1972. It was formally lifted on 17 January 1981.' },
      { title: 'Ninoy Aquino', text: 'Senator Benigno "Ninoy" Aquino Jr. was assassinated on 21 August 1983 at Manila International Airport, now named after him.' },
      { title: 'The snap election', text: 'A snap presidential election was held on 7 February 1986. On 9 February, Commission on Elections computer tabulators walked out, protesting the manipulation of results.' },
      { title: 'The EDSA People Power Revolution', text: 'From 22 to 25 February 1986, millions of Filipinos gathered on EDSA (Epifanio de los Santos Avenue) in a largely peaceful uprising. On 25 February, Corazon Aquino was sworn in as president and the Marcos family left for Hawaii.' },
      { title: 'Radio Veritas', text: 'During the EDSA revolution, the Catholic station Radio Veritas, and later "Radyo Bandido" (June Keithley), broadcast calls for people to gather and protect the defecting soldiers.' },
      { title: 'The 1987 Constitution', text: 'A new constitution was ratified in a plebiscite on 2 February 1987. It limits the president to a single six-year term.' },
    ],
    quiz: [
      { q: 'When did the EDSA People Power Revolution take place?', choices: ['21–23 September 1972', '22–25 February 1986', '21 August 1983', '7 February 1986'], answer: 1, explain: 'The EDSA People Power Revolution ran from 22 to 25 February 1986.' },
      { q: 'What does EDSA stand for?', choices: ['Epifanio de los Santos Avenue', 'Emilio de la Salle Avenue', 'Ermita–Divisoria–San Andres', 'España de los Santos Avenue'], answer: 0, explain: 'EDSA is Epifanio de los Santos Avenue, named after the historian.' },
      { q: 'Which proclamation placed the Philippines under martial law in 1972?', choices: ['Proclamation No. 1081', 'Proclamation No. 2045', 'Republic Act 1425', 'Proclamation No. 1'], answer: 0, explain: 'Proclamation No. 1081, dated 21 September 1972.' },
      { q: 'Who was sworn in as president on 25 February 1986?', choices: ['Fidel V. Ramos', 'Salvador Laurel', 'Corazon Aquino', 'Juan Ponce Enrile'], answer: 2, explain: 'Corazon Aquino became president on 25 February 1986.' },
    ],
  },
};

export const QUIZ_REWARD = 8;
