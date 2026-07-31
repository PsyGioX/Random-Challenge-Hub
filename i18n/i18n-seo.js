/**
 * Random Challenge Hub
 * Dynamic SEO Manager 2026
 * Updates:
 * - title
 * - meta description
 * - keywords
 * - OpenGraph
 * - Twitter Cards
 * - canonical
 * - hreflang
 * - JSON-LD
 * - html lang
 */

window.RCH_SEO = {

    siteUrl: 'https://random-challenge-hub.vercel.app',

    languages: {
        en: {
            locale: 'en_US',
            lang: 'en',
            url: '/'
        },

        ru: {
            locale: 'ru_RU',
            lang: 'ru',
            url: '/?lang=ru'
        },

        uk: {
            locale: 'uk_UA',
            lang: 'uk',
            url: '/?lang=uk'
        }
    },


    update(lang = 'en') {

        const seo = this.getTranslations(lang);

        if (!seo) return;


        // HTML language

        document.documentElement.lang =
            this.languages[lang].lang;



        // Title

        document.title =
            seo.title;



        // Meta

        this.setMeta(
            'description',
            seo.description
        );


        this.setMeta(
            'keywords',
            seo.keywords
        );


        this.setMeta(
            'language',
            seo.language
        );



        // OpenGraph

        this.setProperty(
            'og:title',
            seo.og_title
        );


        this.setProperty(
            'og:description',
            seo.og_description
        );


        this.setProperty(
            'og:locale',
            seo.locale
        );


        this.setProperty(
            'og:image:alt',
            seo.og_image_alt
        );



        // Twitter

        this.setMeta(
            'twitter:title',
            seo.twitter_title
        );


        this.setMeta(
            'twitter:description',
            seo.twitter_description
        );


        this.setMeta(
            'twitter:image:alt',
            seo.twitter_image_alt
        );



        // Canonical

        this.updateCanonical(
            lang
        );


        // hreflang

        this.updateHreflang();



        // JSON-LD

        this.updateSchema(
            seo,
            lang
        );


        console.log(
            '[SEO] Updated:',
            lang
        );

    },



    getTranslations(lang){

        const prefix =
            window.RCH_TRANSLATIONS?.[lang];


        if(!prefix)
            return null;


        return {

            title:
            prefix['meta.title'],

            description:
            prefix['meta.description'],

            keywords:
            prefix['meta.keywords'],

            language:
            prefix['meta.language'],

            locale:
            prefix['meta.locale'],

            og_title:
            prefix['meta.og_title'],

            og_description:
            prefix['meta.og_description'],

            og_image_alt:
            prefix['meta.og_image_alt'],

            twitter_title:
            prefix['meta.twitter_title'],

            twitter_description:
            prefix['meta.twitter_description'],

            twitter_image_alt:
            prefix['meta.twitter_image_alt']
        };

    },



    setMeta(name,value){

        let el =
        document.querySelector(
            `meta[name="${name}"]`
        );


        if(!el){

            el =
            document.createElement('meta');

            el.name=name;

            document.head.appendChild(el);

        }


        el.content=value;

    },



    setProperty(property,value){

        let el =
        document.querySelector(
            `meta[property="${property}"]`
        );


        if(!el){

            el =
            document.createElement('meta');

            el.setAttribute(
                'property',
                property
            );

            document.head.appendChild(el);

        }


        el.content=value;

    },



    updateCanonical(lang){

        let url =
        this.siteUrl +
        this.languages[lang].url;


        let link =
        document.querySelector(
            'link[rel="canonical"]'
        );


        if(link){

            link.href=url;

        }

    },



    updateHreflang(){

        document
        .querySelectorAll(
            'link[data-hreflang]'
        )
        .forEach(
            e=>e.remove()
        );


        Object.entries(
            this.languages
        )
        .forEach(
            ([code,data])=>{


                let link =
                document.createElement('link');


                link.rel='alternate';

                link.hreflang=code;

                link.href=
                this.siteUrl+
                data.url;


                link.dataset.hreflang='true';


                document.head.appendChild(link);

            }
        );


        // x-default

        let def =
        document.createElement('link');


        def.rel='alternate';

        def.hreflang='x-default';

        def.href=this.siteUrl;


        def.dataset.hreflang='true';


        document.head.appendChild(def);

    },



    updateSchema(seo,lang){


        let schema =
        document.querySelector(
            '#rch-schema'
        );


        if(!schema){

            schema =
            document.createElement(
                'script'
            );

            schema.type=
            'application/ld+json';

            schema.id=
            'rch-schema';


            document.head.appendChild(schema);

        }



        schema.textContent =
        JSON.stringify({

            "@context":
            "https://schema.org",

            "@type":
            "WebApplication",

            "name":
            "Random Challenge Hub",

            "description":
            seo.description,

            "url":
            this.siteUrl,

            "inLanguage":
            lang,

            "applicationCategory":
            "EntertainmentApplication",

            "operatingSystem":
            "Any",

            "offers":{
                "@type":"Offer",
                "price":"0",
                "priceCurrency":"USD"
            }

        });

    }

};
