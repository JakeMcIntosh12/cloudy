import { defineField, defineType } from "sanity";

export default defineType({
  name: "aboutContent",
  title: "About Content",
  type: "document",

  fields: [
    defineField({
      name: "briefIntroText",
      title: "Brief Intro Text",
      type: "text",
      rows: 4,
      description:
        "Short introductory text shown after the hero. Used with the ExtrudedElevationReveal intro variant.",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "aboutText",
      title: "About Text",
      type: "text",
      rows: 10,
      description:
        "The main About section text.",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "footerClosingText",
      title: "Footer Closing Text",
      type: "text",
      rows: 6,
      description:
        "Closing text shown in the footer. Used with the ExtrudedElevationReveal footer variant.",
      validation: (Rule) => Rule.required(),
    }),
  ],

  preview: {
    select: {
      title: "briefIntroText",
      aboutText: "aboutText",
      footerClosingText: "footerClosingText",
    },

    prepare({ title, aboutText, footerClosingText }) {
      return {
        title: "About Content",
        subtitle:
          title ||
          aboutText ||
          footerClosingText ||
          "No content added yet",
      };
    },
  },
});