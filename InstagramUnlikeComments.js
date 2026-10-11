/**
 * 
 * OLD VERSION
 * DO NOT USE
 * 
 * Instagram Auto-Unlike Script
 * 
 * This script automates unliking posts from the Likes activity page.
 * URL: https://www.instagram.com/your_activity/interactions/likes
 */

(async function () {
  const UNLIKE_BATCH_SIZE = 10;
  const DELAY_BETWEEN_ACTIONS_MS = 800;
  const DELAY_BETWEEN_CHECKBOX_CLICKS_MS = 120;
  const MAX_RETRIES = 60;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForElement = async (tag, text, timeout = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = Array.from(document.querySelectorAll(tag)).find(
        (x) => x.textContent.trim() === text
      );
      if (el) return el;
      await delay(200);
    }
    throw new Error(`Element "${text}" not found`);
  };

  const clickElement = async (el) => {
    if (!el) throw new Error("Element not found");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.click();
    await delay(DELAY_BETWEEN_ACTIONS_MS);
  };

  const unlikeSelectedPosts = async () => {
    try {
      const unlikeButton = await waitForElement("span", "Unlike");
      await clickElement(unlikeButton);
      const confirmButton = await waitForElement("button", "Unlike");
      await clickElement(confirmButton);
      console.log("Batch unliked.");
    } catch (err) {
      console.error("Unlike error:", err.message);
    }
  };

  const unlikeActivity = async () => {
    try {
      console.log("Starting unlike process...");
      const selectButton = await waitForElement("span", "Select");
      await clickElement(selectButton);
      await delay(DELAY_BETWEEN_ACTIONS_MS);

      const checkboxes = document.querySelectorAll('[aria-label="Toggle checkbox"]');
      if (checkboxes.length === 0) {
        console.log("No more liked posts found.");
        return;
      }

      for (let i = 0; i < Math.min(UNLIKE_BATCH_SIZE, checkboxes.length); i++) {
        await clickElement(checkboxes[i]);
        await delay(DELAY_BETWEEN_CHECKBOX_CLICKS_MS);
      }

      await delay(DELAY_BETWEEN_ACTIONS_MS);
      await unlikeSelectedPosts();

      await delay(5000); // Wait before continuing
      await unlikeActivity();
    } catch (err) {
      console.error("unlikeActivity error:", err.message);
    }
  };

  try {
    await unlikeActivity();
  } catch (fatal) {
    console.error("Fatal:", fatal.message);
  }
})();
