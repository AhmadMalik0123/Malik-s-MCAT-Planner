import javax.swing.*;
import javax.swing.border.*;
import java.awt.*;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.net.URI;
import java.awt.Desktop;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MCATPrepPlanner {
    static final int UWORLD_CP = 1192;
    static final int UWORLD_BB = 875;
    static final int UWORLD_CARS = 463;
    static final int UWORLD_PS = 289;

    static final int AAMC_BIO_QPACK_1 = 120;
    static final int AAMC_BIO_QPACK_2 = 120;
    static final int AAMC_BIO_SECTION_BANK = 100;
    static final int AAMC_CHEM_QPACK = 120;
    static final int AAMC_PHYSICS_QPACK = 120;
    static final int AAMC_CP_SECTION_BANK = 100;
    static final int AAMC_CARS = 575;
    static final int AAMC_CARS_QUESTIONS_PER_PASSAGE = 9;
    static final int AAMC_CARS_PASSAGES = (AAMC_CARS + AAMC_CARS_QUESTIONS_PER_PASSAGE - 1) / AAMC_CARS_QUESTIONS_PER_PASSAGE;
    static final int AAMC_INDEPENDENT = 150;
    static final int AAMC_BIO = AAMC_BIO_QPACK_1 + AAMC_BIO_QPACK_2 + AAMC_BIO_SECTION_BANK;
    static final int AAMC_CP = AAMC_CHEM_QPACK + AAMC_PHYSICS_QPACK + AAMC_CP_SECTION_BANK;
    static final String[] FULL_LENGTHS = {"Unscored", "FL 1", "FL 2", "FL 3", "FL 4", "FL 5", "FL 6"};
    static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("MM/dd/yyyy");

    public static void main(String[] args) {
        ModernUI.install();
        SwingUtilities.invokeLater(() -> new MCATFrame().setVisible(true));
    }

    static class MCATFrame extends JFrame {
        final CardLayout cards = new CardLayout();
        final JPanel content = new JPanel(cards);
        final SetupPanel setupPanel = new SetupPanel(this);
        final CalendarPanel calendarPanel = new CalendarPanel();
        final TodayPanel todayPanel = new TodayPanel();
        final ProgressPanel progressPanel = new ProgressPanel(() -> {
            calendarPanel.refreshSummary();
            if (calendarPanel.plan != null) todayPanel.generate(calendarPanel.plan);
        }, () -> setupPanel.updateCalendar());

        MCATFrame() {
            setTitle("MCAT Prep Calculator");
            setSize(1220, 820);
            setMinimumSize(new Dimension(980, 700));
            setLocationRelativeTo(null);
            setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            setLayout(new BorderLayout());
            add(createNavigation(), BorderLayout.NORTH);
            content.add(setupPanel, "SETUP");
            content.add(calendarPanel, "CALENDAR");
            content.add(todayPanel, "TODAY");
            content.add(progressPanel, "PROGRESS");
            add(content, BorderLayout.CENTER);
            cards.show(content, "SETUP");
        }

        private JPanel createNavigation() {
            JPanel nav = new JPanel(new BorderLayout());
            nav.setBackground(ModernUI.NAVY);
            nav.setBorder(new EmptyBorder(12, 20, 12, 20));
            JLabel brand = new JLabel("MCAT / PREP CALCULATOR");
            brand.setFont(new Font("SansSerif", Font.BOLD, 15));
            brand.setForeground(Color.WHITE);
            JPanel buttons = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
            buttons.setOpaque(false);
            JButton setup = ModernUI.navButton("Setup");
            JButton today = ModernUI.navButton("Today");
            JButton progress = ModernUI.navButton("Progress");
            JButton calendar = ModernUI.navButton("Calendar");
            JButton generate = ModernUI.navButton("Generate Calendar");
            JButton update = ModernUI.darkButton("Update Calendar");
            setup.addActionListener(e -> cards.show(content, "SETUP"));
            today.addActionListener(e -> cards.show(content, "TODAY"));
            progress.addActionListener(e -> cards.show(content, "PROGRESS"));
            calendar.addActionListener(e -> cards.show(content, "CALENDAR"));
            generate.addActionListener(e -> setupPanel.generatePlan());
            update.addActionListener(e -> setupPanel.updateCalendar());
            buttons.add(setup);
            buttons.add(today);
            buttons.add(progress);
            buttons.add(generate);
            buttons.add(update);
            buttons.add(calendar);
            nav.add(brand, BorderLayout.WEST);
            nav.add(buttons, BorderLayout.EAST);
            return nav;
        }

        void showCalendar(PrepPlan plan) {
            calendarPanel.generate(plan);
            todayPanel.generate(plan);
            progressPanel.generate(plan);
            cards.show(content, "TODAY");
        }

        void updateCalendar(PrepPlan plan) {
            calendarPanel.generate(plan);
            todayPanel.generate(plan);
        }
    }

    static class PrepPlan {
        final LocalDate examDate;
        final Set<LocalDate> unavailableDates = new HashSet<>();
        final Set<LocalDate> breakDates = new HashSet<>();
        final Set<DayOfWeek> breakDays = new HashSet<>();
        final Map<String, Integer> uworldTargets = new LinkedHashMap<>();
        final Map<String, Integer> aamcTargets = new LinkedHashMap<>();
        final Map<LocalDate, List<String>> dailyTasks = new TreeMap<>();
        final Map<String, Integer> completedBySection = new LinkedHashMap<>();
        final Map<LocalDate, String> fullLengths = new HashMap<>();

        PrepPlan(LocalDate examDate) {
            this.examDate = examDate;
            uworldTargets.put("UWorld C/P", 0);
            uworldTargets.put("UWorld B/B", 0);
            uworldTargets.put("UWorld P/S", 0);
            aamcTargets.put("AAMC Biology/Biochem.", 0);
            aamcTargets.put("AAMC C/P", 0);
            aamcTargets.put("AAMC Independent", 0);
            aamcTargets.put("AAMC CARS", AAMC_CARS);
            for (String section : uworldTargets.keySet()) completedBySection.put(section, 0);
            for (String section : aamcTargets.keySet()) completedBySection.put(section, 0);
        }
    }

    static class SetupPanel extends JPanel {
        final MCATFrame frame;
        final JTextField examDateField = ModernUI.textField(10);
        final JComboBox<String> uwCPBox = percentageBox();
        final JComboBox<String> uwBBBox = percentageBox();
        final JComboBox<String> uwCARSBox = percentageBox();
        final JComboBox<String> uwPSBox = percentageBox();
        final JComboBox<String> aamcBioBox = percentageBox();
        final JComboBox<String> aamcCPBox = percentageBox();
        final JComboBox<String> aamcIndependentBox = percentageBox();
        final JTextArea unavailableArea = new JTextArea(3, 40);
        final JLabel totalUWorldLabel = new JLabel();
        final JLabel totalAAMCLabel = new JLabel();
        final JCheckBox[] breakBoxes = new JCheckBox[7];
        final JComboBox<String> fullLengthDayBox = ModernUI.comboBox(new String[]{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"});

        SetupPanel(MCATFrame frame) {
            this.frame = frame;
            uwCARSBox.setSelectedItem("100%");
            setBackground(ModernUI.BG);
            setLayout(new BorderLayout());
            setBorder(new EmptyBorder(24, 28, 24, 28));

            JPanel heading = new JPanel();
            heading.setOpaque(false);
            heading.setLayout(new BoxLayout(heading, BoxLayout.Y_AXIS));
            JLabel title = new JLabel("Build your MCAT study calendar");
            title.setFont(new Font("SansSerif", Font.BOLD, 27));
            title.setForeground(ModernUI.TEXT);
            JLabel subtitle = new JLabel("Choose your coverage targets and the days you need protected.");
            subtitle.setFont(new Font("SansSerif", Font.PLAIN, 13));
            subtitle.setForeground(ModernUI.MUTED);
            heading.add(title);
            heading.add(Box.createVerticalStrut(5));
            heading.add(subtitle);
            add(heading, BorderLayout.NORTH);

            JTabbedPane tabs = new JTabbedPane();
            tabs.addTab("Overview", tabScroll(overviewPanel()));
            tabs.addTab("UWorld", tabScroll(targetPanel("UWorld targets", new String[]{"Chemistry / Physics", "Biology / Biochem.", "CARS", "Psychology / Sociology"}, new int[]{UWORLD_CP, UWORLD_BB, UWORLD_CARS, UWORLD_PS}, new JComboBox[]{uwCPBox, uwBBBox, uwCARSBox, uwPSBox}, "Open UWorld MCAT", "https://www.uworld.com/?srsltid=AU7gw4V3fQJIo5Tajbd8fYy4dEsrb_l3rlcHE4yjxfZssxWl5L95cHku")));
            tabs.addTab("AAMC", tabScroll(targetPanel("AAMC official targets", new String[]{"Biology/Biochem.", "Chemistry / Physics", "Independent QBank"}, new int[]{AAMC_BIO, AAMC_CP, AAMC_INDEPENDENT}, new JComboBox[]{aamcBioBox, aamcCPBox, aamcIndependentBox}, "Open AAMC Prep Hub", "https://students-residents.aamc.org/prepare-mcat-exam/aamc-mcat-official-prep-updates")));
            tabs.addTab("Full Lengths", tabScroll(fullLengthPanel()));
            JButton generate = ModernUI.primaryButton("Generate study calendar");
            generate.addActionListener(e -> generatePlan());
            add(tabs, BorderLayout.CENTER);

            JPanel footer = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 12));
            footer.setOpaque(false);
            footer.add(generate);
            add(footer, BorderLayout.SOUTH);

            JComboBox<?>[] boxes = {uwCPBox, uwBBBox, uwCARSBox, uwPSBox, aamcBioBox, aamcCPBox, aamcIndependentBox};
            for (JComboBox<?> box : boxes) box.addActionListener(e -> updateSummary());
            updateSummary();
        }

        private JScrollPane tabScroll(JComponent component) {
            JScrollPane scroll = new JScrollPane(component);
            scroll.setBorder(null);
            scroll.getViewport().setBackground(ModernUI.BG);
            return scroll;
        }

        private JPanel overviewPanel() {
            JPanel panel = new JPanel();
            panel.setOpaque(false);
            panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
            panel.setBorder(new EmptyBorder(20, 4, 10, 4));
            panel.add(examDatePanel());
            panel.add(Box.createVerticalStrut(14));
            panel.add(scheduleConstraintsPanel());
            panel.add(Box.createVerticalStrut(14));
            panel.add(summaryPanel());
            return panel;
        }

        private JPanel fullLengthPanel() {
            JPanel panel = ModernUI.card("Fixed full-length schedule");
            JPanel content = new JPanel();
            content.setOpaque(false);
            content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
            JLabel note = new JLabel("Choose one weekday; each practice exam is placed in the final seven-week sequence.");
            note.setFont(new Font("SansSerif", Font.PLAIN, 13));
            note.setForeground(ModernUI.MUTED);
            content.add(note);
            JPanel dayChoice = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
            dayChoice.setOpaque(false);
            dayChoice.add(new JLabel("Practice full-length day:") );
            dayChoice.add(fullLengthDayBox);
            content.add(dayChoice);
            content.add(Box.createVerticalStrut(16));
            String[] offsets = {"Exam date - 49 days", "Exam date - 42 days", "Exam date - 35 days", "Exam date - 28 days", "Exam date - 21 days", "Exam date - 14 days", "Exam date - 7 days"};
            for (int i = 0; i < FULL_LENGTHS.length; i++) {
                JPanel row = new JPanel(new BorderLayout());
                row.setOpaque(false);
                JLabel name = new JLabel(FULL_LENGTHS[i]);
                name.setFont(new Font("SansSerif", Font.BOLD, 14));
                name.setForeground(ModernUI.ACCENT_DARK);
                JLabel offset = new JLabel(offsets[i]);
                offset.setForeground(ModernUI.MUTED);
                JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
                right.setOpaque(false);
                right.add(offset);
                row.add(name, BorderLayout.WEST);
                row.add(right, BorderLayout.EAST);
                content.add(row);
                content.add(Box.createVerticalStrut(10));
            }
            JLabel examNote = new JLabel("MCAT exam: exam date (automatically protected)");
            examNote.setForeground(ModernUI.WARNING);
            content.add(examNote);
            panel.add(content, BorderLayout.CENTER);
            return panel;
        }

        private JPanel examDatePanel() {
            JPanel panel = ModernUI.card("Exam date");
            JPanel row = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
            row.setOpaque(false);
            examDateField.setText(LocalDate.now().plusDays(100).format(DATE_FORMAT));
            row.add(new JLabel("Exam date (MM/DD/YYYY):"));
            row.add(examDateField);
            panel.add(row, BorderLayout.CENTER);
            return panel;
        }

        private JPanel targetPanel(String title, String[] names, int[] totals, JComboBox[] boxes, String linkText, String linkUrl) {
            JPanel panel = ModernUI.card(title);
            JPanel grid = new JPanel(new GridLayout(names.length + 1, 4, 10, 8));
            grid.setOpaque(false);
            grid.add(ModernUI.sectionLabel("SECTION"));
            grid.add(ModernUI.sectionLabel("TOTAL"));
            grid.add(ModernUI.sectionLabel("TARGET"));
            grid.add(ModernUI.sectionLabel("QUESTIONS"));
            for (int i = 0; i < names.length; i++) addTargetRow(grid, names[i], totals[i], boxes[i]);
            panel.add(grid, BorderLayout.CENTER);
                JLabel carsNote = new JLabel(title.startsWith("AAMC")
                    ? "AAMC CARS: all 575 questions, scheduled backward at 3 passages/day or more when needed"
                    : "UWorld CARS: 3 passages every eligible day; increases when the deadline requires it");
            carsNote.setFont(new Font("SansSerif", Font.BOLD, 12));
            carsNote.setForeground(ModernUI.CARS_DARK);
            JButton link = ModernUI.linkButton(linkText);
            link.addActionListener(e -> openLink(linkUrl));
            JPanel linkRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 4));
            linkRow.setOpaque(false);
            linkRow.add(carsNote);
            linkRow.add(link);
            panel.add(linkRow, BorderLayout.PAGE_END);
            return panel;
        }

        private void openLink(String url) {
            if (!Desktop.isDesktopSupported()) return;
            try {
                Desktop.getDesktop().browse(URI.create(url));
            } catch (Exception ex) {
                JOptionPane.showMessageDialog(this, "Could not open the resource link.", "Browser unavailable", JOptionPane.ERROR_MESSAGE);
            }
        }

        private void addTargetRow(JPanel panel, String name, int total, JComboBox<String> box) {
            JLabel questions = new JLabel(String.valueOf(calculateTarget(total, (String) box.getSelectedItem())));
            box.addActionListener(e -> questions.setText(String.valueOf(calculateTarget(total, (String) box.getSelectedItem()))));
            panel.add(new JLabel(name));
            panel.add(new JLabel(String.valueOf(total)));
            panel.add(box);
            panel.add(questions);
        }

        private JPanel scheduleConstraintsPanel() {
            JPanel panel = ModernUI.card("Schedule constraints");
            JPanel content = new JPanel();
            content.setOpaque(false);
            content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
            JPanel breaks = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
            breaks.setOpaque(false);
            String[] names = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
            for (int i = 0; i < names.length; i++) {
                breakBoxes[i] = new JCheckBox(names[i]);
                breakBoxes[i].setOpaque(false);
                breaks.add(breakBoxes[i]);
            }
            JPanel breakRow = new JPanel(new BorderLayout(10, 0));
            breakRow.setOpaque(false);
            breakRow.add(new JLabel("Weekly break days:"), BorderLayout.WEST);
            breakRow.add(breaks, BorderLayout.CENTER);
            content.add(breakRow);
            content.add(Box.createVerticalStrut(12));
            unavailableArea.setLineWrap(true);
            unavailableArea.setWrapStyleWord(true);
            unavailableArea.setText("09/25/2026, 10/02/2026");
            JPanel unavailable = new JPanel(new BorderLayout(10, 0));
            unavailable.setOpaque(false);
            unavailable.add(new JLabel("Unavailable dates:"), BorderLayout.WEST);
            unavailable.add(new JScrollPane(unavailableArea), BorderLayout.CENTER);
            content.add(unavailable);
            panel.add(content, BorderLayout.CENTER);
            return panel;
        }

        private JPanel summaryPanel() {
            JPanel panel = ModernUI.card("Plan summary");
            JPanel content = new JPanel();
            content.setOpaque(false);
            content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
            totalUWorldLabel.setFont(new Font("SansSerif", Font.BOLD, 14));
            totalAAMCLabel.setFont(new Font("SansSerif", Font.BOLD, 14));
            content.add(totalUWorldLabel);
            content.add(Box.createVerticalStrut(6));
            content.add(totalAAMCLabel);
            panel.add(content, BorderLayout.CENTER);
            return panel;
        }

        private JComboBox<String> percentageBox() {
            return ModernUI.comboBox(new String[]{"0%", "25%", "50%", "75%", "100%"});
        }

        private int calculateTarget(int total, String percentage) {
            int percent = Integer.parseInt(percentage.replace("%", ""));
            return (int) Math.round(total * percent / 100.0);
        }

        private int getTarget(int total, JComboBox<String> box) {
            return calculateTarget(total, (String) box.getSelectedItem());
        }

        private void updateSummary() {
            int uworld = getTarget(UWORLD_CP, uwCPBox) + getTarget(UWORLD_BB, uwBBBox) + getTarget(UWORLD_CARS, uwCARSBox) + getTarget(UWORLD_PS, uwPSBox);
            int aamc = getTarget(AAMC_BIO, aamcBioBox) + getTarget(AAMC_CP, aamcCPBox) + getTarget(AAMC_INDEPENDENT, aamcIndependentBox) + AAMC_CARS;
            totalUWorldLabel.setText("UWorld target: " + uworld + " questions");
            totalAAMCLabel.setText("AAMC target: " + aamc + " questions");
        }

        void generatePlan() {
            LocalDate examDate;
            try {
                examDate = LocalDate.parse(examDateField.getText().trim(), DATE_FORMAT);
            } catch (DateTimeParseException ex) {
                error("Please enter the exam date as MM/DD/YYYY.");
                return;
            }
            if (!examDate.isAfter(LocalDate.now())) {
                error("The exam date must be in the future.");
                return;
            }
            PrepPlan plan = new PrepPlan(examDate);
            plan.uworldTargets.put("UWorld C/P", getTarget(UWORLD_CP, uwCPBox));
            plan.uworldTargets.put("UWorld B/B", getTarget(UWORLD_BB, uwBBBox));
            plan.uworldTargets.put("UWorld CARS", getTarget(UWORLD_CARS, uwCARSBox));
            plan.uworldTargets.put("UWorld P/S", getTarget(UWORLD_PS, uwPSBox));
            plan.aamcTargets.put("AAMC Biology/Biochem.", getTarget(AAMC_BIO, aamcBioBox));
            plan.aamcTargets.put("AAMC C/P", getTarget(AAMC_CP, aamcCPBox));
            plan.aamcTargets.put("AAMC Independent", getTarget(AAMC_INDEPENDENT, aamcIndependentBox));
            plan.aamcTargets.put("AAMC CARS", AAMC_CARS);
            DayOfWeek[] days = DayOfWeek.values();
            for (int i = 0; i < breakBoxes.length; i++) if (breakBoxes[i].isSelected()) plan.breakDays.add(days[i]);
            for (String raw : unavailableArea.getText().replace("\n", "").split(",")) {
                try {
                    if (!raw.trim().isEmpty()) plan.unavailableDates.add(LocalDate.parse(raw.trim(), DATE_FORMAT));
                } catch (DateTimeParseException ignored) { }
            }
            Map<LocalDate, String> selectedFullLengths = new HashMap<>();
            DayOfWeek fullLengthDay = DayOfWeek.of(fullLengthDayBox.getSelectedIndex() + 1);
                for (int i = 0; i < FULL_LENGTHS.length; i++) {
                LocalDate date = examDate.minusDays(49L - (i * 7L));
                while (date.getDayOfWeek() != fullLengthDay) date = date.minusDays(1);
                    if (!date.isAfter(LocalDate.now())) continue;
                    if (plan.unavailableDates.contains(date) || plan.breakDates.contains(date) || plan.breakDays.contains(date.getDayOfWeek())) {
                        continue;
                }
                selectedFullLengths.put(date, FULL_LENGTHS[i]);
            }
                if (selectedFullLengths.isEmpty()) {
                    error("The exam date is too close to schedule a full-length exam.");
                    return;
                }
            plan.fullLengths.putAll(selectedFullLengths);
            plan.fullLengths.put(examDate, "MCAT EXAM");
            plan.breakDates.add(examDate.minusDays(1));
            StudyScheduler.scheduleQuestions(plan);
            frame.showCalendar(plan);
        }

        void updateCalendar() {
            if (frame.calendarPanel.plan == null) {
                error("Generate a study calendar before updating it.");
                return;
            }
            PrepPlan plan = frame.calendarPanel.plan;
            Map<String, Integer> remainingUWorld = remainingTargets(plan.uworldTargets, plan);
            Map<String, Integer> remainingAAMC = remainingTargets(plan.aamcTargets, plan);
            plan.dailyTasks.clear();
            StudyScheduler.scheduleQuestions(plan, remainingUWorld, remainingAAMC);
            frame.updateCalendar(plan);
        }

        private Map<String, Integer> remainingTargets(Map<String, Integer> targets, PrepPlan plan) {
            Map<String, Integer> remaining = new LinkedHashMap<>();
            for (Map.Entry<String, Integer> entry : targets.entrySet()) {
                remaining.put(entry.getKey(), Math.max(0, entry.getValue() - plan.completedBySection.getOrDefault(entry.getKey(), 0)));
            }
            return remaining;
        }

        private void error(String message) {
            JOptionPane.showMessageDialog(this, message, "Invalid plan setup", JOptionPane.ERROR_MESSAGE);
        }
    }

    static class StudyScheduler {
        static void scheduleQuestions(PrepPlan plan) {
            scheduleQuestions(plan, plan.uworldTargets, plan.aamcTargets);
        }

        static void scheduleQuestions(PrepPlan plan, Map<String, Integer> uworldTargets, Map<String, Integer> aamcTargets) {
            List<LocalDate> availableDays = getAvailableStudyDays(plan);
            availableDays.removeIf(plan.fullLengths::containsKey);
            Map<String, Integer> nonCarsUWorld = new LinkedHashMap<>(uworldTargets);
            nonCarsUWorld.remove("UWorld CARS");
            Map<String, Integer> nonCarsAAMC = new LinkedHashMap<>(aamcTargets);
            nonCarsAAMC.remove("AAMC CARS");
            int carsTarget = AAMC_CARS_PASSAGES;
            scheduleCarsBackwards(plan, availableDays, carsTarget);
            int totalUWorld = totalQuestions(nonCarsUWorld);
            int totalAAMC = totalQuestions(nonCarsAAMC);
            int total = totalUWorld + totalAAMC;
            if (total <= 0 || availableDays.isEmpty()) return;
            int uworldDays = totalAAMC == 0 ? availableDays.size() : Math.max(1, Math.min(availableDays.size() - 1, (int) Math.floor(availableDays.size() * 0.40)));
            scheduleBalanced(plan, availableDays, nonCarsUWorld, 0, uworldDays);
            scheduleBalanced(plan, availableDays, nonCarsAAMC, uworldDays, availableDays.size());
            scheduleJackWestin(plan, availableDays);
        }

        static int totalQuestions(Map<String, Integer> assignments) {
            int total = 0;
            for (int amount : assignments.values()) total += amount;
            return total;
        }

        static void scheduleBalanced(PrepPlan plan, List<LocalDate> days, Map<String, Integer> assignments, int start, int end) {
            if (start >= end) return;
            Map<String, Integer> remaining = new LinkedHashMap<>(assignments);
            for (int dayIndex = start; dayIndex < end; dayIndex++) {
                int daysLeft = end - dayIndex;
                LocalDate date = days.get(dayIndex);
                for (Map.Entry<String, Integer> entry : remaining.entrySet()) {
                    int amountLeft = entry.getValue();
                    if (amountLeft <= 0) continue;
                    int amount = Math.max(1, (amountLeft + daysLeft - 1) / daysLeft);
                    plan.dailyTasks.computeIfAbsent(date, ignored -> new ArrayList<>()).add(entry.getKey() + ": " + amount + " questions");
                    entry.setValue(amountLeft - amount);
                }
            }
        }

        static void scheduleCarsBackwards(PrepPlan plan, List<LocalDate> availableDays, int target) {
            int remaining = target;
            if (remaining <= 0 || availableDays.isEmpty()) return;
            int normalDailyPassages = 3;
            int minimumDaysNeeded = (int) Math.ceil(remaining / (double) normalDailyPassages);
            int passagesPerDay = minimumDaysNeeded <= availableDays.size()
                ? normalDailyPassages
                : (int) Math.ceil(remaining / (double) availableDays.size());
            int daysToUse = Math.min(availableDays.size(), minimumDaysNeeded);
            for (int i = availableDays.size() - 1; i >= availableDays.size() - daysToUse; i--) {
                if (remaining <= 0) break;
                LocalDate date = availableDays.get(i);
                int passages = Math.min(passagesPerDay, remaining);
                plan.dailyTasks.computeIfAbsent(date, ignored -> new ArrayList<>()).add("AAMC CARS: " + passages + " passages");
                remaining -= passages;
            }
        }

        static void scheduleJackWestin(PrepPlan plan, List<LocalDate> availableDays) {
            for (LocalDate date : availableDays) {
                List<String> tasks = plan.dailyTasks.get(date);
                boolean hasAAMC = tasks != null && tasks.stream().anyMatch(task -> task.startsWith("AAMC CARS"));
                if (!hasAAMC) {
                    int passages = date.equals(availableDays.get(0)) ? 2 : 3;
                    plan.dailyTasks.computeIfAbsent(date, ignored -> new ArrayList<>()).add("Jack Westin CARS: " + passages + " passages");
                }
            }
        }

        static List<LocalDate> getAvailableStudyDays(PrepPlan plan) {
            List<LocalDate> days = new ArrayList<>();
            LocalDate current = LocalDate.now();
            while (!current.isAfter(plan.examDate.minusDays(1))) {
                if (!plan.unavailableDates.contains(current) && !plan.breakDates.contains(current) && !plan.breakDays.contains(current.getDayOfWeek())) days.add(current);
                current = current.plusDays(1);
            }
            return days;
        }
    }

    static class CalendarPanel extends JPanel {
        final JPanel calendarGrid = new JPanel();
        final JLabel summaryLabel = new JLabel("Generate a plan to view your calendar.");
        final JButton previousMonth = ModernUI.arrowButton("<");
        final JButton nextMonth = ModernUI.arrowButton(">");
        PrepPlan plan;
        LocalDate displayedMonth;
        int dayBlockHeight = 170;

        CalendarPanel() {
            setBackground(ModernUI.BG);
            setLayout(new BorderLayout(14, 14));
            setBorder(new EmptyBorder(24, 28, 24, 28));
            summaryLabel.setFont(new Font("SansSerif", Font.BOLD, 16));
            summaryLabel.setForeground(ModernUI.TEXT);
            JPanel header = new JPanel(new BorderLayout());
            header.setOpaque(false);
            header.add(summaryLabel, BorderLayout.WEST);
            JPanel controls = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
            controls.setOpaque(false);
            controls.add(legend());
            previousMonth.addActionListener(e -> shiftMonth(-1));
            nextMonth.addActionListener(e -> shiftMonth(1));
            controls.add(previousMonth);
            controls.add(nextMonth);
            header.add(controls, BorderLayout.EAST);
            add(header, BorderLayout.NORTH);
            calendarGrid.setOpaque(false);
            calendarGrid.setLayout(new BorderLayout());
            add(calendarGrid, BorderLayout.CENTER);
        }

        private JPanel legend() {
            JPanel legend = new JPanel(new FlowLayout(FlowLayout.RIGHT, 12, 0));
            legend.setOpaque(false);
            legend.add(legendItem("UWorld", ModernUI.UWORLD));
            legend.add(legendItem("AAMC", ModernUI.AAMC));
            return legend;
        }

        private JPanel legendItem(String text, Color color) {
            JPanel item = new JPanel(new FlowLayout(FlowLayout.LEFT, 4, 0));
            item.setOpaque(false);
            JLabel swatch = new JLabel("  ");
            swatch.setOpaque(true);
            swatch.setBackground(color);
            item.add(swatch);
            item.add(new JLabel(text));
            return item;
        }

        void generate(PrepPlan plan) {
            this.plan = plan;
            long daysRemaining = ChronoUnit.DAYS.between(LocalDate.now(), plan.examDate);
            summaryLabel.setText(calendarSummary());
            displayedMonth = LocalDate.now().withDayOfMonth(1);
            renderDisplayedMonth();
        }

        void refreshSummary() {
            if (plan != null) summaryLabel.setText(calendarSummary());
        }

        private void shiftMonth(int amount) {
            if (plan == null) return;
            LocalDate candidate = displayedMonth.plusMonths(amount);
            LocalDate firstMonth = LocalDate.now().withDayOfMonth(1);
            LocalDate lastMonth = plan.examDate.withDayOfMonth(1);
            if (candidate.isBefore(firstMonth) || candidate.isAfter(lastMonth)) return;
            displayedMonth = candidate;
            renderDisplayedMonth();
        }

        private void renderDisplayedMonth() {
            calendarGrid.removeAll();
            calendarGrid.add(createMonthPanel(displayedMonth.getYear(), displayedMonth.getMonthValue(), plan), BorderLayout.CENTER);
            previousMonth.setEnabled(!displayedMonth.equals(LocalDate.now().withDayOfMonth(1)));
            nextMonth.setEnabled(!displayedMonth.equals(plan.examDate.withDayOfMonth(1)));
            calendarGrid.revalidate();
            calendarGrid.repaint();
        }

        private int assignedQuestions(LocalDate date) {
            int total = 0;
            List<String> tasks = plan.dailyTasks.get(date);
            if (tasks == null) return total;
            Pattern number = Pattern.compile("(\\d+)\\s+(?:questions|passages)");
            for (String task : tasks) {
                Matcher matcher = number.matcher(task);
                if (matcher.find()) total += Integer.parseInt(matcher.group(1));
            }
            return total;
        }

        private JPanel createMonthPanel(int year, int month, PrepPlan plan) {
            LocalDate first = LocalDate.of(year, month, 1);
            int leading = first.getDayOfWeek().getValue() - 1;
            int daysInMonth = first.lengthOfMonth();
            int rows = (int) Math.ceil((leading + daysInMonth) / 7.0);
            JPanel monthPanel = new JPanel(new BorderLayout(0, 8));
            monthPanel.setOpaque(false);
            monthPanel.setBorder(new EmptyBorder(8, 0, 0, 0));
            JLabel monthTitle = new JLabel(first.format(DateTimeFormatter.ofPattern("MMMM yyyy")));
            monthTitle.setFont(new Font("SansSerif", Font.BOLD, 20));
            monthTitle.setForeground(ModernUI.TEXT);
            monthPanel.add(monthTitle, BorderLayout.NORTH);
            JPanel weekHeader = new JPanel(new GridLayout(1, 7, 6, 0));
            weekHeader.setOpaque(false);
            for (String day : new String[]{"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}) {
                JLabel label = new JLabel(day);
                label.setFont(new Font("SansSerif", Font.BOLD, 10));
                label.setForeground(ModernUI.MUTED);
                weekHeader.add(label);
            }
            JPanel monthContent = new JPanel(new BorderLayout(0, 5));
            monthContent.setOpaque(false);
            monthContent.add(weekHeader, BorderLayout.NORTH);
            JPanel days = new JPanel(new GridLayout(rows, 7, 6, 6));
            days.setOpaque(false);
            for (int i = 0; i < leading; i++) days.add(new JPanel());
            int busiestDay = 0;
            for (int day = 1; day <= daysInMonth; day++) {
                LocalDate date = LocalDate.of(year, month, day);
                if (!date.isBefore(LocalDate.now()) && !date.isAfter(plan.examDate)) {
                    busiestDay = Math.max(busiestDay, plan.dailyTasks.getOrDefault(date, new ArrayList<>()).size());
                }
            }
            dayBlockHeight = Math.max(170, 82 + busiestDay * 17);
            for (int day = 1; day <= daysInMonth; day++) {
                LocalDate date = LocalDate.of(year, month, day);
                if (!date.isBefore(LocalDate.now()) && !date.isAfter(plan.examDate)) days.add(createDayPanel(date));
                else days.add(createEmptyDayPanel(date));
            }
            while (days.getComponentCount() < rows * 7) days.add(new JPanel());
            monthContent.add(days, BorderLayout.CENTER);
            monthPanel.add(monthContent, BorderLayout.CENTER);
            return monthPanel;
        }

        private JPanel createEmptyDayPanel(LocalDate date) {
            JPanel panel = new JPanel(new BorderLayout());
            panel.setBackground(new Color(237, 241, 246));
            panel.setBorder(new CompoundBorder(new LineBorder(ModernUI.BORDER, 1, true), new EmptyBorder(8, 8, 8, 8)));
            JLabel label = new JLabel(date.format(DateTimeFormatter.ofPattern("d")));
            label.setForeground(ModernUI.MUTED);
            panel.add(label, BorderLayout.NORTH);
            return panel;
        }

        private JPanel createDayPanel(LocalDate date) {
            JPanel panel = new JPanel(new BorderLayout(4, 4));
            panel.setBackground(Color.WHITE);
            panel.setPreferredSize(new Dimension(150, dayBlockHeight));
            panel.setMinimumSize(new Dimension(120, dayBlockHeight));
            panel.setBorder(new CompoundBorder(new LineBorder(ModernUI.BORDER, 1, true), new EmptyBorder(8, 8, 8, 8)));
            JLabel dateLabel = new JLabel("<html><b>" + date.format(DateTimeFormatter.ofPattern("MMM d")) + "</b></html>");
            dateLabel.setForeground(ModernUI.TEXT);
            panel.add(dateLabel, BorderLayout.NORTH);
            if (date.equals(plan.examDate)) return specialDay(panel, "MCAT EXAM", ModernUI.WARNING);
            if (plan.fullLengths.containsKey(date)) return specialDay(panel, plan.fullLengths.get(date), ModernUI.ACCENT);
            if (plan.breakDates.contains(date)) return specialDay(panel, "BREAK", ModernUI.MUTED);
            if (plan.unavailableDates.contains(date)) return specialDay(panel, "UNAVAILABLE", ModernUI.MUTED);
            if (plan.breakDays.contains(date.getDayOfWeek())) return specialDay(panel, "BREAK", ModernUI.MUTED);
            JPanel tasks = new JPanel();
            tasks.setOpaque(false);
            tasks.setLayout(new BoxLayout(tasks, BoxLayout.Y_AXIS));
            List<String> assigned = plan.dailyTasks.get(date);
            if (assigned != null) for (String task : assigned) {
                JLabel taskLabel = new JLabel("<html>" + task + "</html>");
                taskLabel.setFont(new Font("SansSerif", Font.PLAIN, 8));
                taskLabel.setBorder(new EmptyBorder(0, 0, 1, 0));
                taskLabel.setForeground(taskColor(task));
                taskLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
                tasks.add(taskLabel);
                tasks.add(Box.createVerticalStrut(4));
            }
            if (assigned == null || assigned.isEmpty()) {
                JLabel empty = new JLabel("No assigned questions");
                empty.setFont(new Font("SansSerif", Font.ITALIC, 10));
                empty.setForeground(ModernUI.MUTED);
                tasks.add(empty);
            }
            panel.add(tasks, BorderLayout.CENTER);
            return panel;
        }

        private String calendarSummary() {
            int assigned = 0;
            for (LocalDate date : plan.dailyTasks.keySet()) assigned += assignedQuestions(date);
            int completed = 0;
            for (int value : plan.completedBySection.values()) completed += value;
            long daysRemaining = ChronoUnit.DAYS.between(LocalDate.now(), plan.examDate);
            return "Exam: " + plan.examDate.format(DateTimeFormatter.ofPattern("MMM d, yyyy")) + "    |    " + daysRemaining + " days remaining    |    " + completed + " / " + assigned + " questions completed";
        }

        private Color taskColor(String task) {
            if (task.contains("CARS")) return ModernUI.CARS_DARK;
            if (task.startsWith("UWorld C/P")) return ModernUI.UWORLD_CP;
            if (task.startsWith("UWorld B/B")) return ModernUI.UWORLD_BB;
            if (task.startsWith("UWorld P/S")) return ModernUI.UWORLD_PS;
            if (task.startsWith("AAMC Biology")) return ModernUI.AAMC_BIO;
            if (task.startsWith("AAMC C/P")) return ModernUI.AAMC_CP;
            return ModernUI.AAMC_INDEPENDENT;
        }

        private JPanel specialDay(JPanel panel, String text, Color color) {
            JLabel label = new JLabel(text, SwingConstants.CENTER);
            label.setFont(new Font("SansSerif", Font.BOLD, 12));
            label.setForeground(color);
            panel.add(label, BorderLayout.CENTER);
            return panel;
        }
    }

    static class TodayPanel extends JPanel {
        final JLabel daysLabel = new JLabel("Generate a plan to see today's checklist.");
        final JPanel checklist = new JPanel();
        final JPanel progress = new JPanel();
        PrepPlan plan;

        TodayPanel() {
            setBackground(ModernUI.BG);
            setLayout(new BorderLayout(16, 16));
            setBorder(new EmptyBorder(28, 34, 28, 34));
            daysLabel.setFont(new Font("SansSerif", Font.BOLD, 24));
            daysLabel.setForeground(ModernUI.TEXT);
            JPanel heading = new JPanel(new BorderLayout());
            heading.setOpaque(false);
            JPanel greeting = new JPanel();
            greeting.setOpaque(false);
            greeting.setLayout(new BoxLayout(greeting, BoxLayout.Y_AXIS));
            JLabel welcome = new JLabel("Hello Future Doctor!");
            welcome.setFont(new Font("Serif", Font.BOLD, 23));
            welcome.setForeground(new Color(14, 116, 144));
            JLabel encouragement = new JLabel("Good luck with today's assignment.");
            encouragement.setFont(new Font("SansSerif", Font.PLAIN, 12));
            encouragement.setForeground(ModernUI.MUTED);
            greeting.add(welcome);
            greeting.add(Box.createVerticalStrut(3));
            greeting.add(encouragement);
            heading.add(greeting, BorderLayout.WEST);
            heading.add(daysLabel, BorderLayout.EAST);
            add(heading, BorderLayout.NORTH);
            checklist.setOpaque(false);
            checklist.setLayout(new BoxLayout(checklist, BoxLayout.Y_AXIS));
            JPanel checklistCard = ModernUI.card("Today's checklist");
            checklistCard.add(new JScrollPane(checklist), BorderLayout.CENTER);
            progress.setOpaque(false);
            progress.setLayout(new BoxLayout(progress, BoxLayout.Y_AXIS));
            JPanel right = new JPanel();
            right.setOpaque(false);
            right.setPreferredSize(new Dimension(390, 0));
            right.setLayout(new BoxLayout(right, BoxLayout.Y_AXIS));
            right.add(countdownCard());
            right.add(Box.createVerticalStrut(14));
            right.add(progressCard());
            JPanel split = new JPanel(new BorderLayout(18, 0));
            split.setOpaque(false);
            split.add(checklistCard, BorderLayout.CENTER);
            split.add(right, BorderLayout.EAST);
            add(split, BorderLayout.CENTER);
        }

        private JPanel countdownCard() {
            JPanel card = ModernUI.card("Exam countdown");
            card.add(new CountdownChart(), BorderLayout.CENTER);
            return card;
        }

        private JPanel progressCard() {
            JPanel card = ModernUI.card("Question progress");
            card.add(progress, BorderLayout.CENTER);
            return card;
        }

        void generate(PrepPlan plan) {
            this.plan = plan;
            checklist.removeAll();
            long days = ChronoUnit.DAYS.between(LocalDate.now(), plan.examDate);
            daysLabel.setText(days + " days until exam day");
            String fullLength = plan.fullLengths.get(LocalDate.now());
            if (fullLength != null) addChecklistItem(fullLength, ModernUI.ACCENT_DARK);
            if (plan.breakDates.contains(LocalDate.now())) addChecklistItem("PRE-EXAM BREAK DAY", ModernUI.MUTED);
            else if (plan.unavailableDates.contains(LocalDate.now())) addChecklistItem("UNAVAILABLE DAY", ModernUI.MUTED);
            else if (plan.breakDays.contains(LocalDate.now().getDayOfWeek())) addChecklistItem("BREAK DAY", ModernUI.MUTED);
            List<String> tasks = plan.dailyTasks.get(LocalDate.now());
            if (tasks != null) for (String task : tasks) addChecklistItem(task, taskColor(task));
            if ((tasks == null || tasks.isEmpty()) && fullLength == null && !plan.breakDates.contains(LocalDate.now()) && !plan.unavailableDates.contains(LocalDate.now()) && !plan.breakDays.contains(LocalDate.now().getDayOfWeek())) {
                addChecklistItem("No assignments for today", ModernUI.MUTED);
            }
            checklist.revalidate();
            checklist.repaint();
            updateProgress();
        }

        private void updateProgress() {
            progress.removeAll();
            if (plan == null) return;
            addProgressGroup("UWorld", plan.uworldTargets);
            progress.add(Box.createVerticalStrut(12));
            addProgressGroup("AAMC", plan.aamcTargets);
            progress.revalidate();
            progress.repaint();
        }

        private void addProgressGroup(String title, Map<String, Integer> targets) {
            JLabel heading = new JLabel(title);
            heading.setFont(new Font("SansSerif", Font.BOLD, 12));
            heading.setForeground(ModernUI.TEXT);
            progress.add(heading);
            for (Map.Entry<String, Integer> entry : targets.entrySet()) {
                String section = entry.getKey();
                int target = entry.getValue();
                int completed = plan.completedBySection.getOrDefault(section, 0);
                JPanel row = new JPanel(new BorderLayout(6, 3));
                row.setOpaque(false);
                JLabel label = new JLabel(shortSection(section));
                label.setFont(new Font("SansSerif", Font.PLAIN, 10));
                label.setForeground(sectionColor(section));
                JLabel count = new JLabel(completed + " / " + target);
                count.setFont(new Font("SansSerif", Font.PLAIN, 10));
                count.setForeground(ModernUI.MUTED);
                JProgressBar bar = new JProgressBar(0, Math.max(1, target));
                bar.setValue(Math.min(target, completed));
                bar.setForeground(sectionColor(section));
                bar.setBackground(new Color(232, 237, 243));
                bar.setBorderPainted(false);
                JPanel labels = new JPanel(new BorderLayout());
                labels.setOpaque(false);
                labels.add(label, BorderLayout.WEST);
                labels.add(count, BorderLayout.EAST);
                JPanel stack = new JPanel(new BorderLayout(0, 3));
                stack.setOpaque(false);
                stack.add(labels, BorderLayout.NORTH);
                stack.add(bar, BorderLayout.CENTER);
                row.add(stack, BorderLayout.CENTER);
                progress.add(row);
                progress.add(Box.createVerticalStrut(7));
            }
        }

        private String shortSection(String section) {
            return section.replace("UWorld ", "").replace("AAMC ", "");
        }

        private Color sectionColor(String section) {
            if (section.contains("CARS")) return ModernUI.CARS_DARK;
            if (section.contains("C/P")) return section.startsWith("UWorld") ? ModernUI.UWORLD_CP : ModernUI.AAMC_CP;
            if (section.contains("B/B") || section.contains("Biology")) return section.startsWith("UWorld") ? ModernUI.UWORLD_BB : ModernUI.AAMC_BIO;
            if (section.contains("P/S")) return ModernUI.UWORLD_PS;
            return ModernUI.AAMC_INDEPENDENT;
        }

        private void addChecklistItem(String text, Color color) {
            JCheckBox item = new JCheckBox(text);
            item.setOpaque(true);
            item.setBackground(Color.WHITE);
            item.setForeground(color);
            item.setFont(new Font("SansSerif", Font.BOLD, 15));
            item.setBorder(new CompoundBorder(new LineBorder(ModernUI.BORDER, 1, true), new EmptyBorder(14, 14, 14, 14)));
            item.setAlignmentX(Component.LEFT_ALIGNMENT);
            item.setMaximumSize(new Dimension(Integer.MAX_VALUE, 58));
            checklist.add(item);
            checklist.add(Box.createVerticalStrut(10));
        }

        private Color taskColor(String task) {
            if (task.contains("CARS")) return ModernUI.CARS_DARK;
            if (task.startsWith("UWorld C/P")) return ModernUI.UWORLD_CP;
            if (task.startsWith("UWorld B/B")) return ModernUI.UWORLD_BB;
            if (task.startsWith("UWorld P/S")) return ModernUI.UWORLD_PS;
            if (task.startsWith("AAMC Biology")) return ModernUI.AAMC_BIO;
            if (task.startsWith("AAMC C/P")) return ModernUI.AAMC_CP;
            return ModernUI.AAMC_INDEPENDENT;
        }

        class CountdownChart extends JPanel {
            CountdownChart() {
                setOpaque(false);
                setPreferredSize(new Dimension(0, 150));
            }

            @Override protected void paintComponent(Graphics graphics) {
                super.paintComponent(graphics);
                Graphics2D g = (Graphics2D) graphics.create();
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                int days = plan == null ? 0 : (int) ChronoUnit.DAYS.between(LocalDate.now(), plan.examDate);
                int diameter = Math.min(getHeight() - 18, 118);
                int x = (getWidth() - diameter) / 2;
                int y = 8;
                g.setColor(new Color(226, 232, 240));
                g.fillArc(x, y, diameter, diameter, 0, 360);
                g.setColor(ModernUI.ACCENT);
                int progressAngle = days <= 0 ? 360 : Math.max(8, Math.min(359, Math.round(360f * Math.min(days, 365) / 365f)));
                g.fillArc(x, y, diameter, diameter, 90, -progressAngle);
                g.setColor(Color.WHITE);
                int inner = diameter - 26;
                g.fillOval(x + 13, y + 13, inner, inner);
                g.setColor(ModernUI.TEXT);
                g.setFont(new Font("SansSerif", Font.BOLD, 22));
                String value = String.valueOf(Math.max(0, days));
                FontMetrics metrics = g.getFontMetrics();
                g.drawString(value, getWidth() / 2 - metrics.stringWidth(value) / 2, y + diameter / 2 + 6);
                g.setFont(new Font("SansSerif", Font.PLAIN, 10));
                String caption = "days left";
                metrics = g.getFontMetrics();
                g.drawString(caption, getWidth() / 2 - metrics.stringWidth(caption) / 2, y + diameter / 2 + 22);
                g.dispose();
            }
        }
    }

    static class ProgressPanel extends JPanel {
        final JPanel content = new JPanel();
        final JLabel overall = new JLabel("Generate a plan to track progress.");
        final Runnable progressChanged;
        final Runnable calendarUpdater;
        PrepPlan plan;

        ProgressPanel(Runnable progressChanged, Runnable calendarUpdater) {
            this.progressChanged = progressChanged;
            this.calendarUpdater = calendarUpdater;
            setBackground(ModernUI.BG);
            setLayout(new BorderLayout(16, 16));
            setBorder(new EmptyBorder(28, 34, 28, 34));
            overall.setFont(new Font("SansSerif", Font.BOLD, 24));
            overall.setForeground(ModernUI.TEXT);
            JPanel header = new JPanel(new BorderLayout(12, 0));
            header.setOpaque(false);
            header.add(overall, BorderLayout.WEST);
            JButton update = ModernUI.darkButton("Update Calendar");
            update.addActionListener(e -> updateCalendar());
            header.add(update, BorderLayout.EAST);
            add(header, BorderLayout.NORTH);
            content.setOpaque(false);
            content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
            add(content, BorderLayout.CENTER);
        }

        private void updateCalendar() {
            if (plan == null) {
                JOptionPane.showMessageDialog(this, "Generate a study calendar first.", "No plan yet", JOptionPane.INFORMATION_MESSAGE);
                return;
            }
            calendarUpdater.run();
        }

        void generate(PrepPlan plan) {
            this.plan = plan;
            content.removeAll();
            content.add(progressGroup("UWorld completed", plan.uworldTargets));
            content.add(Box.createVerticalStrut(16));
            content.add(progressGroup("AAMC completed", plan.aamcTargets));
            updateOverall();
            content.revalidate();
            content.repaint();
        }

        private JPanel progressGroup(String title, Map<String, Integer> targets) {
            JPanel group = ModernUI.card(title);
            JPanel rows = new JPanel();
            rows.setOpaque(false);
            rows.setLayout(new BoxLayout(rows, BoxLayout.Y_AXIS));
            for (Map.Entry<String, Integer> entry : targets.entrySet()) {
                String section = entry.getKey();
                int target = entry.getValue();
                JPanel row = new JPanel(new BorderLayout(12, 0));
                row.setOpaque(false);
                JLabel label = new JLabel(section);
                label.setFont(new Font("SansSerif", Font.BOLD, 13));
                label.setForeground(sectionColor(section));
                JTextField completed = ModernUI.textField(7);
                completed.setText(String.valueOf(plan.completedBySection.getOrDefault(section, 0)));
                JLabel targetLabel = new JLabel("/ " + target + " questions");
                targetLabel.setForeground(ModernUI.MUTED);
                JPanel input = new JPanel(new FlowLayout(FlowLayout.RIGHT, 5, 0));
                input.setOpaque(false);
                input.add(completed);
                input.add(targetLabel);
                row.add(label, BorderLayout.WEST);
                row.add(input, BorderLayout.EAST);
                completed.addActionListener(e -> save(section, target, completed));
                completed.addFocusListener(new FocusAdapter() {
                    @Override public void focusLost(FocusEvent e) { save(section, target, completed); }
                });
                rows.add(row);
                rows.add(Box.createVerticalStrut(10));
            }
            group.add(rows, BorderLayout.CENTER);
            return group;
        }

        private void save(String section, int target, JTextField field) {
            try {
                int value = Math.max(0, Math.min(target, Integer.parseInt(field.getText().trim())));
                plan.completedBySection.put(section, value);
                field.setText(String.valueOf(value));
                updateOverall();
                progressChanged.run();
            } catch (NumberFormatException ignored) {
                field.setText(String.valueOf(plan.completedBySection.getOrDefault(section, 0)));
            }
        }

        private void updateOverall() {
            int completed = 0;
            int target = 0;
            for (Map.Entry<String, Integer> entry : plan.uworldTargets.entrySet()) {
                target += entry.getValue();
                completed += plan.completedBySection.getOrDefault(entry.getKey(), 0);
            }
            for (Map.Entry<String, Integer> entry : plan.aamcTargets.entrySet()) {
                target += entry.getValue();
                completed += plan.completedBySection.getOrDefault(entry.getKey(), 0);
            }
            overall.setText("Progress: " + completed + " / " + target + " questions completed");
        }

        private Color sectionColor(String section) {
            if (section.contains("CARS")) return ModernUI.CARS_DARK;
            if (section.contains("C/P")) return section.startsWith("UWorld") ? ModernUI.UWORLD_CP : ModernUI.AAMC_CP;
            if (section.contains("B/B") || section.contains("Biology")) return section.startsWith("UWorld") ? ModernUI.UWORLD_BB : ModernUI.AAMC_BIO;
            if (section.contains("P/S")) return ModernUI.UWORLD_PS;
            return ModernUI.AAMC_INDEPENDENT;
        }
    }

    static class ModernUI {
        static final Color BG = new Color(244, 247, 251);
        static final Color PANEL = Color.WHITE;
        static final Color BORDER = new Color(220, 228, 236);
        static final Color TEXT = new Color(17, 24, 39);
        static final Color MUTED = new Color(100, 116, 139);
        static final Color ACCENT = new Color(79, 70, 229);
        static final Color ACCENT_DARK = new Color(55, 48, 163);
        static final Color SUCCESS = new Color(16, 185, 129);
        static final Color WARNING = new Color(239, 68, 68);
        static final Color NAVY = new Color(20, 31, 51);
        static final Color UWORLD = new Color(59, 130, 246);
        static final Color UWORLD_DARK = new Color(29, 78, 216);
        static final Color AAMC = new Color(245, 158, 11);
        static final Color AAMC_DARK = new Color(180, 83, 9);
        static final Color UWORLD_CP = new Color(37, 99, 235);
        static final Color UWORLD_BB = new Color(5, 150, 105);
        static final Color UWORLD_PS = new Color(124, 58, 237);
        static final Color AAMC_BIO = new Color(13, 148, 136);
        static final Color AAMC_CP = new Color(220, 38, 38);
        static final Color AAMC_INDEPENDENT = new Color(217, 119, 6);
        static final Color CARS_DARK = new Color(194, 65, 12);

        static void install() {
            try { UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName()); } catch (Exception ignored) { }
            UIManager.put("control", BG);
            UIManager.put("Panel.background", BG);
            UIManager.put("ScrollPane.background", BG);
            UIManager.put("TextField.background", Color.WHITE);
            UIManager.put("ComboBox.background", Color.WHITE);
            UIManager.put("Label.foreground", TEXT);
            UIManager.put("nimbusBase", ACCENT);
            UIManager.put("nimbusFocus", ACCENT);
            UIManager.put("nimbusSelectionBackground", ACCENT);
            UIManager.put("nimbusSelectionForeground", Color.WHITE);
        }

        static JPanel card(String title) {
            JPanel panel = new JPanel(new BorderLayout(10, 10));
            panel.setBackground(PANEL);
            panel.setBorder(new CompoundBorder(new LineBorder(BORDER, 1, true), new EmptyBorder(14, 14, 14, 14)));
            JLabel label = new JLabel(title);
            label.setFont(new Font("SansSerif", Font.BOLD, 15));
            label.setForeground(TEXT);
            panel.add(label, BorderLayout.NORTH);
            return panel;
        }

        static JButton primaryButton(String text) {
            JButton button = new JButton(text);
            button.setFocusPainted(false);
            button.setBackground(ACCENT);
            button.setForeground(Color.WHITE);
            button.setFont(new Font("SansSerif", Font.BOLD, 14));
            button.setBorder(new EmptyBorder(11, 18, 11, 18));
            button.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            return button;
        }

        static JButton darkButton(String text) {
            JButton button = new JButton(text);
            button.setFocusPainted(false);
            button.setBackground(Color.BLACK);
            button.setForeground(Color.WHITE);
            button.setFont(new Font("SansSerif", Font.BOLD, 14));
            button.setBorder(new EmptyBorder(11, 20, 11, 20));
            button.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            return button;
        }

        static JButton navButton(String text) {
            JButton button = new JButton(text);
            button.setFocusPainted(false);
            button.setBackground(NAVY);
            button.setForeground(Color.WHITE);
            button.setBorder(new EmptyBorder(7, 14, 7, 14));
            return button;
        }

        static JButton arrowButton(String text) {
            JButton button = new JButton(text);
            button.setFocusPainted(false);
            button.setFont(new Font("SansSerif", Font.BOLD, 16));
            button.setForeground(TEXT);
            button.setBackground(Color.WHITE);
            button.setBorder(new CompoundBorder(new LineBorder(BORDER, 1, true), new EmptyBorder(4, 12, 4, 12)));
            button.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            return button;
        }

        static JButton linkButton(String text) {
            JButton button = new JButton(text);
            button.setFocusPainted(false);
            button.setBorderPainted(false);
            button.setContentAreaFilled(false);
            button.setForeground(ACCENT_DARK);
            button.setFont(new Font("SansSerif", Font.BOLD, 12));
            button.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            return button;
        }

        static JTextField textField(int columns) {
            JTextField field = new JTextField(columns);
            field.setBorder(new CompoundBorder(new LineBorder(BORDER, 1, true), new EmptyBorder(7, 9, 7, 9)));
            field.setBackground(Color.WHITE);
            field.setForeground(TEXT);
            return field;
        }

        static JComboBox<String> comboBox(String[] items) {
            JComboBox<String> box = new JComboBox<>(items);
            box.setBackground(Color.WHITE);
            box.setForeground(TEXT);
            box.setBorder(new LineBorder(BORDER, 1, true));
            box.setFont(new Font("SansSerif", Font.PLAIN, 12));
            return box;
        }

        static JLabel sectionLabel(String text) {
            JLabel label = new JLabel(text);
            label.setFont(new Font("SansSerif", Font.BOLD, 10));
            label.setForeground(MUTED);
            return label;
        }
    }
}
