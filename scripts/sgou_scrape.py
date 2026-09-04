import requests
from bs4 import BeautifulSoup
import json
from urllib.parse import urljoin
import time

base_url = "https://sgou.ac.in"
main_url = urljoin(base_url, "/public/slmprogrammes")

def get_programme_links_with_level():
    """
    Scrapes the main SLM page and returns a list of dictionaries:
    [
        {
            "url": "https://sgou.ac.in/public/slmprogrammes/slm-list/6",
            "name": "BACHELOR OF ARTS (ARABIC)",
            "level": "UG"
        },
        ...
    ]
    """
    print(f"Fetching main page: {main_url}")
    resp = requests.get(main_url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')

    # Tab ID to level mapping
    tab_level_map = {
        "v-pills-home": "UG",
        "v-pills-profile": "FYUG",   # four-year programmes
        "v-pills-messages": "PG"
    }

    programmes = []
    for tab_id, level in tab_level_map.items():
        tab = soup.find("div", id=tab_id)
        if not tab:
            continue
        # Find all <a> tags inside this tab
        for a in tab.find_all("a", href=True):
            href = a['href']
            if "/public/slmprogrammes/slm-list/" in href:
                full_url = urljoin(base_url, href)
                programme_name = a.get_text(strip=True)
                # Clean up name if needed (e.g., remove extra spaces, but keep as is)
                programmes.append({
                    "url": full_url,
                    "name": programme_name,
                    "level": level
                })
    # Remove duplicates (in case same link appears in multiple tabs – unlikely)
    unique = {}
    for p in programmes:
        if p["url"] not in unique:
            unique[p["url"]] = p
    return list(unique.values())

def scrape_programme_details(programme_info):
    """
    Scrapes a single programme page and returns a full record:
    {
        "programme_name": "...",
        "level": "...",
        "url": "...",
        "semesters": [ ... ]
    }
    """
    url = programme_info["url"]
    print(f"Scraping: {url}")
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f"  Failed to fetch {url}: {e}")
        return None

    soup = BeautifulSoup(resp.text, 'html.parser')
    # Programme name is already known from main page, no need to parse title
    programme_name = programme_info["name"]
    level = programme_info["level"]

    semesters = []
    semester_headers = soup.find_all("li", class_="semester-header")
    for header in semester_headers:
        semester = header.get("data-semester")
        if not semester:
            continue
        courses = []
        # Find all course items that follow this header until the next semester header
        next_siblings = header.find_next_siblings("li", class_="course-item")
        for item in next_siblings:
            if item.get("data-semester") != semester:
                break
            # Extract course name and code
            text = item.get_text(strip=True)
            # Remove any trailing "Download PDF" text (if present)
            name = text.split("Download PDF")[0].strip()
            pdf_tag = item.find("a", href=True)
            pdf_url = pdf_tag['href'] if pdf_tag else None
            # Extract course code (usually the last segment after " - ")
            code = None
            parts = name.split(" - ")
            if len(parts) > 1 and parts[-1] and parts[-1][0].isalnum():
                code = parts[-1].strip()
                name = " - ".join(parts[:-1])
            courses.append({
                "name": name,
                "code": code,
                "pdf_url": pdf_url
            })
        if courses:
            semesters.append({
                "semester": semester,
                "courses": courses
            })
    return {
        "programme_name": programme_name,
        "level": level,
        "url": url,
        "semesters": semesters
    }

def main():
    programme_list = get_programme_links_with_level()
    print(f"Found {len(programme_list)} programmes")

    all_data = []
    for prog in programme_list:
        data = scrape_programme_details(prog)
        if data:
            all_data.append(data)
        time.sleep(1)  # be polite to the server

    # Save to JSON file
    with open("sgou_slm_dataset.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False)

    print(f"Done. Saved {len(all_data)} programmes to sgou_slm_dataset.json")

if __name__ == "__main__":
    main()
