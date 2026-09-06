import { defineField, defineType } from "sanity";

export default defineType({
  name: "homeContent",
  title: "Home Content",
  type: "document",

  fields: [
    defineField({
      name: "heroVideo",
      title: "Hero Background Video",
      type: "file",
      options: {
        accept: "video/*",
      },
      description:
        "The large background video displayed in the homepage Hero. Upload the video directly to Sanity.",
      validation: (Rule) => Rule.required(),
    }),
  ],

  preview: {
    select: {
      title: "heroVideo.asset.originalFilename",
    },

    prepare({ title }) {
      return {
        title: "Home Content",
        subtitle: title
          ? `Hero Video: ${title}`
          : "No hero video uploaded",
      };
    },
  },
});