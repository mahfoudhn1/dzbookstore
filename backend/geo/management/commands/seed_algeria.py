import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from geo.models import Wilaya, Commune
from catalog.models import Author, Publisher, Category, Work, Edition
from accounts.models import BookstoreProfile, IndividualSellerProfile
from marketplace.models import Offer, Review

User = get_user_model()

WILAYAS_DATA = [
    (1, "01", "أدرار", "Adrar"),
    (2, "02", "الشلف", "Chlef"),
    (3, "03", "الأغواط", "Laghouat"),
    (4, "04", "أم البواقي", "Oum El Bouaghi"),
    (5, "05", "باتنة", "Batna"),
    (6, "06", "بجاية", "Béjaïa"),
    (7, "07", "بسكرة", "Biskra"),
    (8, "08", "بشار", "Béchar"),
    (9, "09", "البليدة", "Blida"),
    (10, "10", "البويرة", "Bouira"),
    (11, "11", "تمنراست", "Tamanrasset"),
    (12, "12", "تبسة", "Tébessa"),
    (13, "13", "تلمسان", "Tlemcen"),
    (14, "14", "تيارت", "Tiaret"),
    (15, "15", "تيزي وزو", "Tizi Ouzou"),
    (16, "16", "الجزائر", "Alger"),
    (17, "17", "الجلفة", "Djelfa"),
    (18, "18", "جيجل", "Jijel"),
    (19, "19", "سطيف", "Sétif"),
    (20, "20", "سعيدة", "Saïda"),
    (21, "21", "سكيكدة", "Skikda"),
    (22, "22", "سيدي بلعباس", "Sidi Bel Abbès"),
    (23, "23", "عنابة", "Annaba"),
    (24, "24", "قالمة", "Guelma"),
    (25, "25", "قسنطينة", "Constantine"),
    (26, "26", "المدية", "Médéa"),
    (27, "27", "مستغانم", "Mostaganem"),
    (28, "28", "المسيلة", "M'Sila"),
    (29, "29", "معسكر", "Mascara"),
    (30, "30", "ورقلة", "Ouargla"),
    (31, "31", "وهران", "Oran"),
    (32, "32", "البيض", "El Bayadh"),
    (33, "33", "إليزي", "Illizi"),
    (34, "34", "برج بوعريريج", "Bordj Bou Arreridj"),
    (35, "35", "بومرداس", "Boumerdès"),
    (36, "36", "الطارف", "El Tarf"),
    (37, "37", "تندوف", "Tindouf"),
    (38, "38", "تيسمسيلت", "Tissemsilt"),
    (39, "39", "الوادي", "El Oued"),
    (40, "40", "خنشلة", "Khenchela"),
    (41, "41", "سوق أهراس", "Souk Ahras"),
    (42, "42", "تيبازة", "Tipaza"),
    (43, "43", "ميلة", "Mila"),
    (44, "44", "عين الدفلى", "Aïn Defla"),
    (45, "45", "النعامة", "Naâma"),
    (46, "46", "عين تموشنت", "Aïn Témouchent"),
    (47, "47", "غرداية", "Ghardaïa"),
    (48, "48", "غليزان", "Relizane"),
    (49, "49", "المغير", "El M'Ghair"),
    (50, "50", "المنيعة", "El Meniaa"),
    (51, "51", "أولاد جلال", "Ouled Djellal"),
    (52, "52", "برج باجي مختار", "Bordj Baji Mokhtar"),
    (53, "53", "بني عباس", "Béni Abbès"),
    (54, "54", "تيميمون", "Timimoun"),
    (55, "55", "تقرت", "Touggourt"),
    (56, "56", "جانت", "Djanet"),
    (57, "57", "عين صالح", "In Salah"),
    (58, "58", "عين قزام", "In Guezzam"),
]

COMMUNES_SEED = [
    (16, "الجزائر الوسطى", "Alger Centre", "16000"),
    (16, "باب الوادي", "Bab El Oued", "16008"),
    (16, "القبة", "Kouba", "16050"),
    (16, "حيدرة", "Hydra", "16035"),
    (16, "سيدي امحمد", "Sidi M'Hamed", "16005"),
    (31, "وهران", "Oran Ville", "31000"),
    (31, "السانية", "Es Sénia", "31100"),
    (31, "بئر الجير", "Bir El Djir", "31011"),
    (25, "قسنطينة", "Constantine Centre", "25000"),
    (25, "الخروب", "El Khroub", "25100"),
    (15, "تيزي وزو", "Tizi Ouzou", "15000"),
    (6, "بجاية", "Béjaïa Ville", "06000"),
    (19, "سطيف", "Sétif Ville", "19000"),
    (23, "عنابة", "Annaba Centre", "23000"),
    (13, "تلمسان", "Tlemcen Centre", "13000"),
]

class Command(BaseCommand):
    help = "Seed database with Algerian Wilayas, authors, publishers, books, verified bookstores, and multi-seller offers"

    def handle(self, *args, **options):
        self.stdout.write("1. Seeding 58 Algerian Wilayas...")
        for wid, code, name_ar, name_fr in WILAYAS_DATA:
            Wilaya.objects.update_or_create(
                id=wid,
                defaults={'code': code, 'name_ar': name_ar, 'name_fr': name_fr}
            )

        self.stdout.write("2. Seeding Communes...")
        for wid, name_ar, name_fr, postal in COMMUNES_SEED:
            wilaya = Wilaya.objects.get(id=wid)
            Commune.objects.get_or_create(
                wilaya=wilaya,
                name_fr=name_fr,
                defaults={'name_ar': name_ar, 'postal_code': postal}
            )

        alger = Wilaya.objects.get(id=16)
        oran = Wilaya.objects.get(id=31)
        constantine = Wilaya.objects.get(id=25)
        tizi = Wilaya.objects.get(id=15)

        c_alger_centre = Commune.objects.filter(wilaya=alger, name_fr="Alger Centre").first()
        c_kouba = Commune.objects.filter(wilaya=alger, name_fr="Kouba").first()
        c_oran = Commune.objects.filter(wilaya=oran, name_fr="Oran Ville").first()
        c_constantine = Commune.objects.filter(wilaya=constantine, name_fr="Constantine Centre").first()
        c_tizi = Commune.objects.filter(wilaya=tizi, name_fr="Tizi Ouzou").first()

        self.stdout.write("3. Creating Categories...")
        cat_lit, _ = Category.objects.get_or_create(
            slug="litterature-algerienne",
            defaults={"name_fr": "Littérature Algérienne", "name_ar": "أدب جزائري", "icon": "BookOpen"}
        )
        cat_hist, _ = Category.objects.get_or_create(
            slug="histoire-et-revolution",
            defaults={"name_fr": "Histoire & Révolution", "name_ar": "تاريخ وثورة التحرير", "icon": "Landmark"}
        )
        cat_philo, _ = Category.objects.get_or_create(
            slug="pensee-et-philosophie",
            defaults={"name_fr": "Pensée & Philosophie", "name_ar": "فكر وفلسفة إسلامية", "icon": "Sparkles"}
        )
        cat_romans, _ = Category.objects.get_or_create(
            slug="romans-et-fictions",
            defaults={"name_fr": "Romans & Fictions", "name_ar": "روايات وقصص", "icon": "BookMarked"}
        )
        cat_scolaire, _ = Category.objects.get_or_create(
            slug="scolaire-universitaire",
            defaults={"name_fr": "Scolaire & Universitaire", "name_ar": "كتب مدرسية وجامعية", "icon": "GraduationCap"}
        )

        self.stdout.write("4. Creating Publishers...")
        pub_barzakh, _ = Publisher.objects.get_or_create(
            slug="editions-barzakh",
            defaults={"name": "Éditions Barzakh", "country": "Algérie", "website": "https://www.editions-barzakh.dz"}
        )
        pub_casbah, _ = Publisher.objects.get_or_create(
            slug="casbah-editions",
            defaults={"name": "Casbah Éditions", "country": "Algérie", "website": "https://www.casbah-editions.com"}
        )
        pub_enag, _ = Publisher.objects.get_or_create(
            slug="enag-editions",
            defaults={"name": "ENAG Éditions", "country": "Algérie"}
        )
        pub_hikma, _ = Publisher.objects.get_or_create(
            slug="dar-el-hikma",
            defaults={"name": "Dar El Hikma", "country": "Algérie"}
        )
        pub_seuil, _ = Publisher.objects.get_or_create(
            slug="editions-du-seuil",
            defaults={"name": "Éditions du Seuil", "country": "France"}
        )

        self.stdout.write("5. Creating Authors...")
        auth_kateb, _ = Author.objects.get_or_create(
            slug="kateb-yacine",
            defaults={
                "name": "Kateb Yacine",
                "name_ar": "كاتب ياسين",
                "nationality": "Algérienne",
                "biography": "Écrivain majeur de la littérature algérienne, auteur de 'Nedjma', figure intellectuelle engagée."
            }
        )
        auth_feraoun, _ = Author.objects.get_or_create(
            slug="mouloud-feraoun",
            defaults={
                "name": "Mouloud Feraoun",
                "name_ar": "مولود فرعون",
                "nationality": "Algérienne",
                "biography": "Écrivain kabyle algérien et témoin lucide de la guerre d'indépendance, auteur du 'Fils du pauvre'."
            }
        )
        auth_khadra, _ = Author.objects.get_or_create(
            slug="yasmina-khadra",
            defaults={
                "name": "Yasmina Khadra",
                "name_ar": "ياسمينة خضرا",
                "nationality": "Algérienne",
                "biography": "Romancier algérien traduit dans le monde entier, auteur de 'L'Attentat' et 'Les Hirondelles de Kaboul'."
            }
        )
        auth_bennabi, _ = Author.objects.get_or_create(
            slug="malek-bennabi",
            defaults={
                "name": "Malek Bennabi",
                "name_ar": "مالك بن نبي",
                "nationality": "Algérienne",
                "biography": "Penseur musulman et philosophe algérien du XXe siècle, théoricien de la renaissance civilisationnelle."
            }
        )
        auth_mosteghanemi, _ = Author.objects.get_or_create(
            slug="ahlam-mosteghanemi",
            defaults={
                "name": "Ahlam Mosteghanemi",
                "name_ar": "أحلام مستغانمي",
                "nationality": "Algérienne",
                "biography": "Première femme algérienne à publier un roman en arabe, célèbre pour sa trilogie 'Mémoires de la chair'."
            }
        )

        self.stdout.write("6. Creating Canonical Works & Editions...")
        # Work 1: Nedjma
        w_nedjma, _ = Work.objects.get_or_create(
            slug="nedjma",
            defaults={
                "title": "Nedjma",
                "original_title": "نجمة",
                "original_language": "fr",
                "featured": True,
                "cover_image": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=600&auto=format&fit=crop",
                "synopsis": "Chef-d'œuvre fondateur de la littérature algérienne moderne. Quatre jeunes hommes — Lakhdar, Mustapha, Rachid et Mourad — sont épris de Nedjma, femme mythique et énigmatique incarnant l'Algérie en quête d'indépendance."
            }
        )
        w_nedjma.authors.set([auth_kateb])
        w_nedjma.categories.set([cat_lit, cat_romans])

        ed_nedjma_barzakh, _ = Edition.objects.get_or_create(
            work=w_nedjma,
            isbn13="9789961892813",
            defaults={
                "publisher": pub_barzakh,
                "publication_year": 2008,
                "edition_title": "Édition Nationale Barzakh",
                "format": "Broché",
                "language": "Français",
                "page_count": 286,
                "cover_image": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=600&auto=format&fit=crop"
            }
        )

        ed_nedjma_seuil, _ = Edition.objects.get_or_create(
            work=w_nedjma,
            isbn13="9782020286800",
            defaults={
                "publisher": pub_seuil,
                "publication_year": 1996,
                "edition_title": "Points Seuil",
                "format": "Poche",
                "language": "Français",
                "page_count": 260
            }
        )

        # Work 2: Le Fils du pauvre
        w_fils, _ = Work.objects.get_or_create(
            slug="le-fils-du-pauvre",
            defaults={
                "title": "Le Fils du pauvre",
                "original_title": "ابن الفقير",
                "original_language": "fr",
                "featured": True,
                "cover_image": "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=600&auto=format&fit=crop",
                "synopsis": "Récit autobiographique poignant décrivant l'enfance de Fouroulou Menrad dans un village de Kabylie, la lutte contre la misère, et l'ascension par l'école et le savoir."
            }
        )
        w_fils.authors.set([auth_feraoun])
        w_fils.categories.set([cat_lit, cat_scolaire])

        ed_fils_enag, _ = Edition.objects.get_or_create(
            work=w_fils,
            isbn13="9789961622345",
            defaults={
                "publisher": pub_enag,
                "publication_year": 2012,
                "edition_title": "Édition Scolaire ENAG",
                "format": "Broché",
                "language": "Français",
                "page_count": 180,
                "cover_image": "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=600&auto=format&fit=crop"
            }
        )

        # Work 3: Les Conditions de la renaissance
        w_bennabi, _ = Work.objects.get_or_create(
            slug="les-conditions-de-la-renaissance",
            defaults={
                "title": "Les Conditions de la renaissance",
                "original_title": "شروط النهضة",
                "original_language": "fr",
                "featured": True,
                "cover_image": "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=600&auto=format&fit=crop",
                "synopsis": "Analyse magistrale de Malek Bennabi sur les mécanismes historiques, psychologiques et culturels nécessaires au réveil du monde arabo-musulman et au dépassement de la 'colonisabilité'."
            }
        )
        w_bennabi.authors.set([auth_bennabi])
        w_bennabi.categories.set([cat_philo, cat_hist])

        ed_bennabi_hikma, _ = Edition.objects.get_or_create(
            work=w_bennabi,
            isbn13="9789961906782",
            defaults={
                "publisher": pub_hikma,
                "publication_year": 2005,
                "edition_title": "Édition Intégrale Dar El Hikma",
                "format": "Grand Format",
                "language": "Français",
                "page_count": 224,
                "cover_image": "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=600&auto=format&fit=crop"
            }
        )

        # Work 4: L'Attentat
        w_attentat, _ = Work.objects.get_or_create(
            slug="l-attentat",
            defaults={
                "title": "L'Attentat",
                "original_title": "الصدمة",
                "original_language": "fr",
                "featured": True,
                "cover_image": "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=600&auto=format&fit=crop",
                "synopsis": "L'histoire déchirante du Dr Amine Jaafari, chirurgien reconnu qui découvre avec stupeur que sa femme adorée est l'auteure d'une attaque suicide dévastatrice."
            }
        )
        w_attentat.authors.set([auth_khadra])
        w_attentat.categories.set([cat_romans, cat_lit])

        ed_attentat_casbah, _ = Edition.objects.get_or_create(
            work=w_attentat,
            isbn13="9789961645431",
            defaults={
                "publisher": pub_casbah,
                "publication_year": 2006,
                "edition_title": "Édition Algérienne Casbah",
                "format": "Broché",
                "language": "Français",
                "page_count": 272,
                "cover_image": "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=600&auto=format&fit=crop"
            }
        )

        # Work 5: Mémoires de la chair (ذاكرة الجسد)
        w_memoires, _ = Work.objects.get_or_create(
            slug="memoires-de-la-chair",
            defaults={
                "title": "Mémoires de la chair",
                "original_title": "ذاكرة الجسد",
                "original_language": "ar",
                "featured": True,
                "cover_image": "https://images.unsplash.com/photo-1476275466078-4007374efbbe?q=80&w=600&auto=format&fit=crop",
                "synopsis": "À Paris, Khaled, peintre manchot ancien combattant de la guerre de libération, rencontre Hayat, la fille de son commandant Si Taher, devenue romancière. Une passion enchevêtrée de mémoire et de nostalgie pour Constantine."
            }
        )
        w_memoires.authors.set([auth_mosteghanemi])
        w_memoires.categories.set([cat_romans, cat_lit])

        ed_memoires_casbah, _ = Edition.objects.get_or_create(
            work=w_memoires,
            isbn13="9789961641020",
            defaults={
                "publisher": pub_casbah,
                "publication_year": 1998,
                "edition_title": "Version Originale Arabe",
                "format": "Broché",
                "language": "العربية",
                "page_count": 340,
                "cover_image": "https://images.unsplash.com/photo-1476275466078-4007374efbbe?q=80&w=600&auto=format&fit=crop"
            }
        )

        self.stdout.write("7. Creating Users & Bookstores...")
        # Admin user
        admin_user, _ = User.objects.get_or_create(
            email="admin@bookstoredz.dz",
            defaults={
                "username": "admin",
                "role": User.Role.ADMIN,
                "first_name": "Admin",
                "last_name": "BookstoreDZ",
                "wilaya": alger,
                "is_staff": True,
                "is_superuser": True
            }
        )
        admin_user.set_password("admin123456")
        admin_user.save()

        # Bookstore 1: Librairie du Tiers-Monde (Alger)
        u_tiers_monde, _ = User.objects.get_or_create(
            email="contact@tiers-monde.dz",
            defaults={"username": "tiers_monde", "role": User.Role.BOOKSTORE_SELLER, "wilaya": alger}
        )
        u_tiers_monde.set_password("seller123456")
        u_tiers_monde.save()

        b_tiers_monde, _ = BookstoreProfile.objects.update_or_create(
            user=u_tiers_monde,
            defaults={
                "store_name": "Librairie du Tiers-Monde",
                "slug": "librairie-du-tiers-monde-alger",
                "description": "Librairie historique emblématique d'Alger située sur la place Emir Abdelkader. Référence incontournable en littérature algérienne, essais et livres d'art.",
                "address": "Place Emir Abdelkader, Alger Centre",
                "wilaya": alger,
                "commune": c_alger_centre,
                "latitude": 36.7753,
                "longitude": 3.0588,
                "phone": "021 73 89 22",
                "whatsapp": "0550 12 34 56",
                "opening_hours": "Samedi - Jeudi: 08h30 - 19h00",
                "is_verified": True,
                "verification_status": BookstoreProfile.VerificationStatus.VERIFIED,
                "logo_url": "https://images.unsplash.com/photo-1507842229451-79b1be886820?q=80&w=200&auto=format&fit=crop",
                "banner_url": "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?q=80&w=1200&auto=format&fit=crop"
            }
        )

        # Bookstore 2: Librairie Chaib Dzaïr (Alger)
        u_chaib, _ = User.objects.get_or_create(
            email="contact@chaibdzair.dz",
            defaults={"username": "chaib_dzair", "role": User.Role.BOOKSTORE_SELLER, "wilaya": alger}
        )
        u_chaib.set_password("seller123456")
        u_chaib.save()

        b_chaib, _ = BookstoreProfile.objects.update_or_create(
            user=u_chaib,
            defaults={
                "store_name": "Librairie Chaib Dzaïr (ANEP)",
                "slug": "librairie-chaib-dzair-alger",
                "description": "Espace culturel de l'ANEP face à la mer, riche en éditions nationales, beaux-livres et histoire contemporaine de l'Algérie.",
                "address": "1 Avenue Pasteur / Boulevard Zighout Youcef, Alger",
                "wilaya": alger,
                "commune": c_alger_centre,
                "latitude": 36.7731,
                "longitude": 3.0610,
                "phone": "021 73 55 10",
                "opening_hours": "Samedi - Jeudi: 09h00 - 18h30",
                "is_verified": True,
                "verification_status": BookstoreProfile.VerificationStatus.VERIFIED,
                "logo_url": "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?q=80&w=200&auto=format&fit=crop"
            }
        )

        # Bookstore 3: Librairie El Qods (Oran)
        u_elqods, _ = User.objects.get_or_create(
            email="librairie.elqods.oran@gmail.com",
            defaults={"username": "elqods_oran", "role": User.Role.BOOKSTORE_SELLER, "wilaya": oran}
        )
        u_elqods.set_password("seller123456")
        u_elqods.save()

        b_elqods, _ = BookstoreProfile.objects.update_or_create(
            user=u_elqods,
            defaults={
                "store_name": "Librairie El Qods",
                "slug": "librairie-el-qods-oran",
                "description": "La plus ancienne librairie du centre-ville d'Oran, au cœur de la rue Larbi Ben M'hidi. Large choix de romans, ouvrages académiques et scolaires.",
                "address": "42 Rue Larbi Ben M'hidi, Oran",
                "wilaya": oran,
                "commune": c_oran,
                "latitude": 35.6987,
                "longitude": -0.6349,
                "phone": "041 33 22 11",
                "whatsapp": "0661 22 33 44",
                "opening_hours": "Samedi - Jeudi: 09h00 - 19h30",
                "is_verified": True,
                "verification_status": BookstoreProfile.VerificationStatus.VERIFIED,
                "logo_url": "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=200&auto=format&fit=crop"
            }
        )

        # Bookstore 4: Librairie Médina (Constantine)
        u_medina, _ = User.objects.get_or_create(
            email="medina.constantine@yahoo.com",
            defaults={"username": "medina_constantine", "role": User.Role.BOOKSTORE_SELLER, "wilaya": constantine}
        )
        u_medina.set_password("seller123456")
        u_medina.save()

        b_medina, _ = BookstoreProfile.objects.update_or_create(
            user=u_medina,
            defaults={
                "store_name": "Librairie Médina",
                "slug": "librairie-medina-constantine",
                "description": "Librairie généraliste de la ville des ponts suspendus, située Place de la Brèche. Spécialiste des ouvrages sur Malek Bennabi et la pensée islamique.",
                "address": "Place du 1er Novembre (La Brèche), Constantine",
                "wilaya": constantine,
                "commune": c_constantine,
                "latitude": 36.3650,
                "longitude": 6.6147,
                "phone": "031 92 40 15",
                "opening_hours": "Samedi - Jeudi: 08h30 - 18h00",
                "is_verified": True,
                "verification_status": BookstoreProfile.VerificationStatus.VERIFIED,
                "logo_url": "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=200&auto=format&fit=crop"
            }
        )

        self.stdout.write("8. Creating Individual Secondhand Sellers...")
        # Individual Seller 1: Karim Bouzid (Alger)
        u_karim, _ = User.objects.get_or_create(
            email="karim.bouzid@gmail.com",
            defaults={"username": "karim_bouzid", "role": User.Role.INDIVIDUAL_SELLER, "wilaya": alger}
        )
        u_karim.set_password("buyer123456")
        u_karim.save()

        s_karim, _ = IndividualSellerProfile.objects.update_or_create(
            user=u_karim,
            defaults={
                "display_name": "Karim Bouzid",
                "bio": "Étudiant en master de littérature comparée à Alger 2. Je revends des livres de ma bibliothèque personnelle en excellent état.",
                "wilaya": alger,
                "commune": c_kouba,
                "phone": "0554 99 88 77",
                "whatsapp": "0554 99 88 77",
                "trust_score": 4.9
            }
        )

        # Individual Seller 2: Amine Benmoussa (Oran)
        u_amine, _ = User.objects.get_or_create(
            email="amine.oran.books@gmail.com",
            defaults={"username": "amine_oran", "role": User.Role.INDIVIDUAL_SELLER, "wilaya": oran}
        )
        u_amine.set_password("buyer123456")
        u_amine.save()

        s_amine, _ = IndividualSellerProfile.objects.update_or_create(
            user=u_amine,
            defaults={
                "display_name": "Amine Benmoussa",
                "bio": "Passionné d'histoire et de romans algériens. Remise en main propre possible sur Oran ou expédition Yalidine.",
                "wilaya": oran,
                "commune": c_oran,
                "phone": "0770 11 22 33",
                "trust_score": 4.8
            }
        )

        # Individual Seller 3: Sarah Belkacem (Constantine)
        u_sarah, _ = User.objects.get_or_create(
            email="sarah.constantine.lit@gmail.com",
            defaults={"username": "sarah_constantine", "role": User.Role.INDIVIDUAL_SELLER, "wilaya": constantine}
        )
        s_sarah, _ = IndividualSellerProfile.objects.update_or_create(
            user=u_sarah,
            defaults={
                "display_name": "Sarah Belkacem",
                "bio": "Amatrice d'ouvrages arabophones et de poésie. Vente de livres soignés et protégés.",
                "wilaya": constantine,
                "commune": c_constantine,
                "phone": "0669 44 55 66",
                "trust_score": 5.0
            }
        )

        self.stdout.write("9. Creating Multi-Seller Offers (ONE BOOK -> MULTIPLE OFFERS)...")
        # Offers for Nedjma
        # 1. Bookstore offer: Tiers-Monde (Alger) - New Barzakh edition
        Offer.objects.get_or_create(
            work=w_nedjma,
            bookstore=b_tiers_monde,
            seller_type=Offer.SellerType.BOOKSTORE,
            defaults={
                "edition": ed_nedjma_barzakh,
                "price": 1200.0,
                "original_price": 1400.0,
                "condition": Offer.Condition.NEW,
                "condition_description": "Exemplaire neuf sous blister éditeur Barzakh.",
                "stock_quantity": 12,
                "has_store_pickup": True,
                "has_home_delivery": True,
                "has_stop_desk_delivery": True,
                "home_delivery_fee": 550.0,
                "stop_desk_fee": 350.0
            }
        )

        # 2. Bookstore offer: El Qods (Oran) - New Barzakh edition
        Offer.objects.get_or_create(
            work=w_nedjma,
            bookstore=b_elqods,
            seller_type=Offer.SellerType.BOOKSTORE,
            defaults={
                "edition": ed_nedjma_barzakh,
                "price": 1250.0,
                "condition": Offer.Condition.NEW,
                "condition_description": "En stock en magasin à Oran, retrait immédiat possible.",
                "stock_quantity": 6,
                "has_store_pickup": True,
                "has_home_delivery": True,
                "has_stop_desk_delivery": True,
                "home_delivery_fee": 600.0,
                "stop_desk_fee": 350.0
            }
        )

        # 3. Secondhand offer: Karim Bouzid (Alger) - Points Seuil edition, Good condition
        Offer.objects.get_or_create(
            work=w_nedjma,
            individual_seller=s_karim,
            seller_type=Offer.SellerType.INDIVIDUAL,
            defaults={
                "edition": ed_nedjma_seuil,
                "price": 650.0,
                "condition": Offer.Condition.GOOD,
                "condition_description": "Édition de poche Points Seuil. Papier légèrement jauni par le temps mais pages propres, sans annotations ni surlignage. Remise en main propre possible à Kouba.",
                "photos": [
                    "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=600&auto=format&fit=crop",
                    "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=600&auto=format&fit=crop"
                ],
                "stock_quantity": 1,
                "has_store_pickup": False,
                "has_home_delivery": True,
                "has_stop_desk_delivery": True,
                "home_delivery_fee": 500.0,
                "stop_desk_fee": 300.0
            }
        )

        # Offers for Le Fils du pauvre
        # 1. Bookstore offer: Chaib Dzaïr (Alger) - New ENAG edition
        Offer.objects.get_or_create(
            work=w_fils,
            bookstore=b_chaib,
            seller_type=Offer.SellerType.BOOKSTORE,
            defaults={
                "edition": ed_fils_enag,
                "price": 750.0,
                "condition": Offer.Condition.NEW,
                "condition_description": "Édition officielle ENAG pour collèges et lycées.",
                "stock_quantity": 25,
                "has_store_pickup": True,
                "has_home_delivery": True,
                "has_stop_desk_delivery": True,
                "home_delivery_fee": 500.0,
                "stop_desk_fee": 300.0
            }
        )

        # 2. Secondhand offer: Amine Benmoussa (Oran) - Like New
        Offer.objects.get_or_create(
            work=w_fils,
            individual_seller=s_amine,
            seller_type=Offer.SellerType.INDIVIDUAL,
            defaults={
                "edition": ed_fils_enag,
                "price": 400.0,
                "condition": Offer.Condition.LIKE_NEW,
                "condition_description": "Lu une seule fois, état impeccable comme neuf.",
                "photos": ["https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=600&auto=format&fit=crop"],
                "stock_quantity": 1,
                "has_store_pickup": False,
                "has_home_delivery": True,
                "has_stop_desk_delivery": True,
                "home_delivery_fee": 550.0,
                "stop_desk_fee": 350.0
            }
        )

        # Offers for Les Conditions de la renaissance
        # 1. Bookstore offer: Médina (Constantine) - New Dar El Hikma
        Offer.objects.get_or_create(
            work=w_bennabi,
            bookstore=b_medina,
            seller_type=Offer.SellerType.BOOKSTORE,
            defaults={
                "edition": ed_bennabi_hikma,
                "price": 850.0,
                "condition": Offer.Condition.NEW,
                "condition_description": "Édition intégrale grand format, disponible à La Brèche Constantine.",
                "stock_quantity": 15,
                "has_store_pickup": True,
                "has_home_delivery": True,
                "has_stop_desk_delivery": True,
                "home_delivery_fee": 550.0,
                "stop_desk_fee": 350.0
            }
        )

        # 2. Bookstore offer: Tiers-Monde (Alger)
        Offer.objects.get_or_create(
            work=w_bennabi,
            bookstore=b_tiers_monde,
            seller_type=Offer.SellerType.BOOKSTORE,
            defaults={
                "edition": ed_bennabi_hikma,
                "price": 900.0,
                "condition": Offer.Condition.NEW,
                "condition_description": "En rayon à Alger Centre.",
                "stock_quantity": 8,
                "has_store_pickup": True,
                "has_home_delivery": True,
                "has_stop_desk_delivery": True,
                "home_delivery_fee": 550.0,
                "stop_desk_fee": 350.0
            }
        )

        # Offers for L'Attentat
        Offer.objects.get_or_create(
            work=w_attentat,
            bookstore=b_chaib,
            seller_type=Offer.SellerType.BOOKSTORE,
            defaults={
                "edition": ed_attentat_casbah,
                "price": 1050.0,
                "condition": Offer.Condition.NEW,
                "condition_description": "Éditions Casbah tirage algérien officiel.",
                "stock_quantity": 14,
                "has_store_pickup": True,
                "has_home_delivery": True,
                "has_stop_desk_delivery": True,
                "home_delivery_fee": 500.0,
                "stop_desk_fee": 300.0
            }
        )

        # Offers for Mémoires de la chair
        Offer.objects.get_or_create(
            work=w_memoires,
            bookstore=b_tiers_monde,
            seller_type=Offer.SellerType.BOOKSTORE,
            defaults={
                "edition": ed_memoires_casbah,
                "price": 1150.0,
                "condition": Offer.Condition.NEW,
                "condition_description": "Texte intégral en langue arabe (طبعة دار الآداب / القصبة).",
                "stock_quantity": 10,
                "has_store_pickup": True,
                "has_home_delivery": True,
                "has_stop_desk_delivery": True,
                "home_delivery_fee": 550.0,
                "stop_desk_fee": 350.0
            }
        )

        Offer.objects.get_or_create(
            work=w_memoires,
            individual_seller=s_sarah,
            seller_type=Offer.SellerType.INDIVIDUAL,
            defaults={
                "edition": ed_memoires_casbah,
                "price": 550.0,
                "condition": Offer.Condition.VERY_GOOD,
                "condition_description": "Exemplaire en très bon état, couverture intacte, aucune page déchirée.",
                "photos": ["https://images.unsplash.com/photo-1476275466078-4007374efbbe?q=80&w=600&auto=format&fit=crop"],
                "stock_quantity": 1,
                "has_store_pickup": False,
                "has_home_delivery": True,
                "has_stop_desk_delivery": True,
                "home_delivery_fee": 500.0,
                "stop_desk_fee": 300.0
            }
        )

        self.stdout.write(self.style.SUCCESS("Seeding completed successfully!"))
        self.stdout.write(self.style.SUCCESS(f"Total Wilayas: {Wilaya.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"Total Works: {Work.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"Total Bookstores: {BookstoreProfile.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"Total Offers: {Offer.objects.count()}"))
